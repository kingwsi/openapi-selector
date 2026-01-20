<script setup>
import { ref, reactive, computed } from 'vue';
import ImportSection from './components/ImportSection.vue';
import Workspace from './components/Workspace.vue';

// --- State ---
const step = ref('import'); // 'import' | 'workspace'
const currentFilename = ref('swagger');
const originalData = ref(null);
const endpoints = ref([]);
const selectedIds = reactive(new Set());

// --- Actions ---

function handleDataLoaded({ data, filename }) {
  if (!data.paths) {
    alert("Invalid Swagger/OpenAPI file: 'paths' missing.");
    return;
  }
  
  originalData.value = data;
  currentFilename.value = filename || 'swagger';
  endpoints.value = [];
  selectedIds.clear();
  
  let idCounter = 0;
  // Flatten paths
  for (const [path, methods] of Object.entries(data.paths)) {
    for (const [method, details] of Object.entries(methods)) {
      if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())) {
        endpoints.value.push({
          id: idCounter++,
          path,
          method: method.toUpperCase(),
          summary: details.summary || '',
          description: details.description || '',
          tags: details.tags || [],
          data: details
        });
      }
    }
  }

  step.value = 'workspace';
}

// --- Export Logic ---

function exportJson() {
  const pruned = getPrunedSwagger();
  const timestamp = getTimestamp();
  const filename = `${currentFilename.value}-${timestamp}.json`;
  downloadFile(JSON.stringify(pruned, null, 2), filename, 'text/json');
}

function exportMarkdown() {
  const pruned = getPrunedSwagger();
  let md = `# ${pruned.info?.title || 'API Context'}\n\n`;
  if (pruned.info?.description) md += `${pruned.info.description}\n\n`;

  md += `## Endpoints\n\n`;

  const sortedPaths = Object.keys(pruned.paths).sort();

  sortedPaths.forEach(path => {
    const methods = pruned.paths[path];
    for (const method in methods) {
      const op = methods[method];
      md += `### ${method.toUpperCase()} ${path}\n`;
      if (op.summary) md += `**Summary**: ${op.summary}\n\n`;
      if (op.description) md += `**Description**: ${op.description}\n\n`;

      // Parameters
      if (op.parameters && op.parameters.length > 0) {
        md += `**Parameters**:\n`;
        op.parameters.forEach(p => {
          const req = p.required ? '(Required)' : '(Optional)';
          let type = p.type;
          if (!type && p.schema) {
            if (p.schema.type) type = p.schema.type;
            else if (p.schema.$ref) type = p.schema.$ref.split('/').pop();
            else type = 'Object';
          }
          if (!type) type = 'String';

          const desc = p.description ? ` - ${p.description}` : '';
          md += `- \`${p.name}\` (${p.in}, ${type}) ${req}${desc}\n`;
        });
        md += `\n`;
      }

      // Request Body
      if (op.requestBody) {
        md += `**Request Body**:\n`;
        const content = op.requestBody.content || {};
        const jsonContent = content['application/json'];
        if (jsonContent && jsonContent.schema) {
          let schema = jsonContent.schema;
          if (schema.$ref) {
            const resolved = resolveRef(pruned, schema.$ref);
            if (resolved) schema = resolved;
          }
          md += `\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\`\n\n`;
        }
      }

      // Responses
      if (op.responses) {
        md += `**Responses**:\n`;
        for (const code in op.responses) {
          const res = op.responses[code];
          md += `- **${code}**: ${res.description || ''}\n`;

          let schema = res.schema || (res.content && res.content['application/json'] ? res.content['application/json'].schema : null);
          if (schema) {
            if (schema.$ref) {
              const resolved = resolveRef(pruned, schema.$ref);
              if (resolved) schema = resolved;
            }
            md += `\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\`\n`;
          }
        }
        md += `\n`;
      }
      md += `---\n\n`;
    }
  });

  // Models
  md += `## Data Models\n\n`;
  md += `The following schemas are referenced in the endpoints above.\n\n`;

  const definitions = pruned.definitions || (pruned.components ? pruned.components.schemas : {});
  if (Object.keys(definitions).length > 0) {
    for (const name in definitions) {
      md += `### ${name}\n`;
      const def = definitions[name];
      md += `\`\`\`json\n${JSON.stringify(def, null, 2)}\n\`\`\`\n\n`;
    }
  } else {
    md += `*No separate models defined.*\n`;
  }

  const timestamp = getTimestamp();
  const filename = `${currentFilename.value}-${timestamp}.md`;
  downloadFile(md, filename, 'text/markdown');
}


// --- Pruning Helpers ---

function getPrunedSwagger() {
  const newSwagger = JSON.parse(JSON.stringify(originalData.value));
  newSwagger.paths = {};

  if (newSwagger.definitions) newSwagger.definitions = {};
  if (newSwagger.components && newSwagger.components.schemas) newSwagger.components.schemas = {};

  const usedRefs = new Set();

  endpoints.value.forEach(ep => {
    if (selectedIds.has(ep.id)) {
      if (!newSwagger.paths[ep.path]) {
        newSwagger.paths[ep.path] = {};
      }
      newSwagger.paths[ep.path][ep.method.toLowerCase()] = ep.data;
      findRefs(ep.data, usedRefs);
    }
  });

  // Filter global tags based on selected endpoints
  if (newSwagger.tags && Array.isArray(newSwagger.tags)) {
    const usedTags = new Set();
    endpoints.value.forEach(ep => {
      if (selectedIds.has(ep.id) && ep.tags) {
        ep.tags.forEach(t => usedTags.add(t));
      }
    });
    newSwagger.tags = newSwagger.tags.filter(t => usedTags.has(t.name));
  }

  const resolvedDefs = new Set();
  const refsQueue = Array.from(usedRefs);

  while (refsQueue.length > 0) {
    const ref = refsQueue.pop();
    if (resolvedDefs.has(ref)) continue;
    resolvedDefs.add(ref);

    const def = resolveRef(originalData.value, ref);
    if (def) {
      addDefToSwagger(newSwagger, ref, def);
      const childRefs = new Set();
      findRefs(def, childRefs);
      childRefs.forEach(r => {
        if (!resolvedDefs.has(r)) {
          usedRefs.add(r);
          refsQueue.push(r);
        }
      });
    }
  }
  return newSwagger;
}

function findRefs(obj, refSet) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach(item => findRefs(item, refSet));
    return;
  }
  if (obj.$ref) {
    refSet.add(obj.$ref);
  }
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      findRefs(obj[key], refSet);
    }
  }
}

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) return null;
  const parts = ref.split('/').slice(1);
  let current = root;
  for (const part of parts) {
    current = current[part];
    if (!current) return null;
  }
  return current;
}

function addDefToSwagger(root, ref, defContent) {
  const parts = ref.split('/').slice(1);
  let current = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part]) current[part] = {};
    current = current[part];
  }
  const finalKey = parts[parts.length - 1];
  current[finalKey] = defContent;
}

function getTimestamp() {
  const now = new Date();
  return now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '-' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
}

function downloadFile(content, filename, contentType) {
  const dataStr = `data:${contentType};charset=utf-8,` + encodeURIComponent(content);
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", filename);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

</script>

<template>
  <div class="app-container">
    <a href="https://github.com/kingwsi/openapi-selector" target="_blank" class="github-link" aria-label="View on GitHub">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
        </svg>
    </a>

    <!-- Header -->
    <header class="app-header">
        <div class="logo">
            <h1>Selector</h1>
        </div>
        <p class="tagline">Import, filter, and export<br>your API definitions.</p>
    </header>

    <!-- Content -->
    <ImportSection 
      v-if="step === 'import'" 
      @data-loaded="handleDataLoaded" 
    />

    <Workspace 
      v-else 
      :endpoints="endpoints" 
      :selected-ids="selectedIds"
    />

    <!-- Floating Footer (Visible when workspace is active) -->
    <div class="floating-footer" v-if="step === 'workspace'">
        <button class="btn btn-primary btn-lg" 
          @click="exportMarkdown" 
          :disabled="selectedIds.size === 0"
          style="background-color: white; color: var(--primary-black); border: 1px solid var(--border-light); margin-right: 12px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Markdown
        </button>
        <button class="btn btn-primary btn-lg" 
          @click="exportJson" 
          :disabled="selectedIds.size === 0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export JSON
        </button>
    </div>

  </div>
</template>
