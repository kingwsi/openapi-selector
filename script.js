
/**
 * Swagger Selector App Logic
 */

// State
let originalData = null; // Full JSON object
let endpoints = []; // Flattened list: { id, path, method, summary, description, tags, originalRef }
let selectedIds = new Set();
let currentFilename = 'swagger'; // Default base filename

// Elements
const dom = {
    importSection: document.getElementById('importSection'),
    workspace: document.getElementById('workspace'),
    urlInput: document.getElementById('urlInput'),
    loadUrlBtn: document.getElementById('loadUrlBtn'),
    fileInput: document.getElementById('fileInput'),
    dropZone: document.getElementById('dropZone'),
    errorMessage: document.getElementById('errorMessage'),

    endpointsList: document.getElementById('endpointsList'),
    searchInput: document.getElementById('searchInput'),
    selectedCount: document.getElementById('selectedCount'),
    totalCount: document.getElementById('totalCount'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    resetSelectionBtn: document.getElementById('resetSelectionBtn'),
    exportBtn: document.getElementById('exportBtn'),
};

// --- Initialization ---
function init() {
    setupEventListeners();
}

function setupEventListeners() {
    // Import
    dom.loadUrlBtn.addEventListener('click', loadFromUrl);
    dom.dropZone.addEventListener('click', () => dom.fileInput.click());
    dom.fileInput.addEventListener('change', handleFileUpload);

    // Drag & Drop
    dom.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dom.dropZone.classList.add('drag-over');
    });
    dom.dropZone.addEventListener('dragleave', () => {
        dom.dropZone.classList.remove('drag-over');
    });
    dom.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // Filtering & Selection
    dom.searchInput.addEventListener('input', renderList);
    dom.selectAllBtn.addEventListener('click', toggleSelectAll);
    dom.resetSelectionBtn.addEventListener('click', resetSelection);

    // Export
    dom.exportBtn.addEventListener('click', exportJson);
    dom.exportMdBtn = document.getElementById('exportMdBtn');
    dom.exportMdBtn.addEventListener('click', exportMarkdown);
}

// --- Import Logic ---

async function loadFromUrl() {
    const url = dom.urlInput.value.trim();
    if (!url) return showError("Please enter a URL.");

    showError(null); // Clear errors
    dom.loadUrlBtn.textContent = "Loading...";
    dom.loadUrlBtn.disabled = true;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        const data = await response.json();

        // Extract filename from URL
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            let name = pathParts[pathParts.length - 1] || 'swagger';
            // Remove extension if present
            if (name.indexOf('.') !== -1) {
                name = name.substring(0, name.lastIndexOf('.'));
            }
            currentFilename = name;
        } catch (e) {
            currentFilename = 'remote-api';
        }

        processSwaggerData(data);
    } catch (err) {
        showError(`Failed to load URL: ${err.message}. Ensure CORS is enabled or use file upload.`);
    } finally {
        dom.loadUrlBtn.textContent = "Load";
        dom.loadUrlBtn.disabled = false;
    }
}

function handleFileUpload(e) {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
}

function handleFile(file) {
    showError(null);

    // Set filename from file object
    const name = file.name;
    currentFilename = name.substring(0, name.lastIndexOf('.')) || name;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            processSwaggerData(data);
        } catch (err) {
            showError("Invalid JSON file.");
        }
    };
    reader.readAsText(file);
}

function showError(msg) {
    if (msg) {
        dom.errorMessage.textContent = msg;
        dom.errorMessage.style.display = 'block';
    } else {
        dom.errorMessage.style.display = 'none';
    }
}

// --- Processing ---

function processSwaggerData(data) {
    if (!data.paths) return showError("Invalid Swagger/OpenAPI file: 'paths' missing.");

    originalData = data;
    endpoints = [];
    let idCounter = 0;

    // Flatten paths
    for (const [path, methods] of Object.entries(data.paths)) {
        for (const [method, details] of Object.entries(methods)) {
            // Skip non-method keys like 'parameters' if they exist at path level (common in Swagger 2.0)
            if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())) {
                endpoints.push({
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

    // Initialize UI
    selectedIds.clear();
    dom.importSection.style.display = 'none';
    dom.workspace.style.display = 'block';
    dom.totalCount.textContent = endpoints.length;

    renderList();
    updateStats();
}

// --- Rendering ---

function renderList() {
    const query = dom.searchInput.value.toLowerCase();
    dom.endpointsList.innerHTML = '';

    const filtered = endpoints.filter(ep =>
        ep.path.toLowerCase().includes(query) ||
        ep.summary.toLowerCase().includes(query) ||
        ep.method.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        dom.endpointsList.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">No matching endpoints found.</div>`;
        return;
    }

    // Group by first tag
    const groups = new Map();
    filtered.forEach(ep => {
        const tag = (ep.tags && ep.tags.length > 0) ? ep.tags[0] : 'Default';
        if (!groups.has(tag)) {
            groups.set(tag, []);
        }
        groups.get(tag).push(ep);
    });

    // Render Groups
    const sortedTags = Array.from(groups.keys()).sort();

    sortedTags.forEach(tag => {
        const groupEndpoints = groups.get(tag);

        // Group Container
        const groupContainer = document.createElement('div');
        groupContainer.className = 'group-container';

        // Header
        const header = document.createElement('div');
        header.className = 'group-header';

        // Check if all selected in this group
        const allSelected = groupEndpoints.every(ep => selectedIds.has(ep.id));

        header.innerHTML = `
            <div class="group-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="chevron" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                <span>${tag}</span>
                <span class="group-count">${groupEndpoints.length}</span>
            </div>
            <div class="group-actions">
               <button class="btn-text" title="Toggle group selection">
                   ${allSelected ? 'Deselect All' : 'Select All'}
               </button>
            </div>
        `;

        // Endpoints List Container
        const content = document.createElement('div');
        content.className = 'group-content';

        // Toggle Expand
        header.querySelector('.group-title').addEventListener('click', () => {
            content.classList.toggle('collapsed');
            header.querySelector('.chevron').classList.toggle('rotated');
        });

        // Group Selection
        const actionBtn = header.querySelector('.btn-text');
        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const shouldSelect = !allSelected;

            groupEndpoints.forEach(ep => {
                if (shouldSelect) selectedIds.add(ep.id);
                else selectedIds.delete(ep.id);
            });
            updateStats();
            renderList();
        });

        // Render Items inside Group
        groupEndpoints.forEach(ep => {
            const item = createEndpointItem(ep, query);
            content.appendChild(item);
        });

        groupContainer.appendChild(header);
        groupContainer.appendChild(content);
        dom.endpointsList.appendChild(groupContainer);
    });
}

function createEndpointItem(ep, query) {
    const item = document.createElement('div');
    item.className = `endpoint-item ${selectedIds.has(ep.id) ? 'selected' : ''}`;

    // Toggle on click
    item.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;
            toggleSelection(ep.id, checkbox.checked);
            if (checkbox.checked) item.classList.add('selected');
            else item.classList.remove('selected');

            // Updating header state would require re-render or complex DOM traversal.
            // For simplicity in this vanilla JS app, we will rely on global stats update.
            // If user wants perfectly synced "Select All" text, a full renderList is safest.
            // But to avoid scroll jumping, we skip full render here.
        }
    });

    const isChecked = selectedIds.has(ep.id) ? 'checked' : '';

    item.innerHTML = `
        <div class="col-check">
            <input type="checkbox" ${isChecked} onclick="event.stopPropagation(); toggleSelection(${ep.id}, this.checked); this.closest('.endpoint-item').classList.toggle('selected', this.checked);">
        </div>
        <div class="col-method">
            <span class="method-badge method-${ep.method}">${ep.method}</span>
        </div>
        <div class="col-path" title="${ep.path}">${highlightText(ep.path, query)}</div>
        <div class="col-summary" title="${ep.summary}">${highlightText(ep.summary, query)}</div>
    `;
    return item;
}

function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

// --- Selection Logic ---

function toggleSelection(id, isSelected) {
    if (isSelected) {
        selectedIds.add(id);
    } else {
        selectedIds.delete(id);
    }
    updateStats();
}

function updateStats() {
    dom.selectedCount.textContent = selectedIds.size;
    const hasSelection = selectedIds.size > 0;
    dom.exportBtn.disabled = !hasSelection;
    if (dom.exportMdBtn) dom.exportMdBtn.disabled = !hasSelection;
}

function toggleSelectAll() {
    const query = dom.searchInput.value.toLowerCase();
    const filteredIds = endpoints
        .filter(ep =>
            ep.path.toLowerCase().includes(query) ||
            ep.summary.toLowerCase().includes(query)
        )
        .map(ep => ep.id);

    const allSelected = filteredIds.every(id => selectedIds.has(id));

    if (allSelected) {
        filteredIds.forEach(id => selectedIds.delete(id));
    } else {
        filteredIds.forEach(id => selectedIds.add(id));
    }
    renderList();
    updateStats();
}

function resetSelection() {
    selectedIds.clear();
    renderList();
    updateStats();
}

// --- Export Logic ---

// --- Pruning Helper ---

function getPrunedSwagger() {
    // 1. Setup new Root
    const newSwagger = JSON.parse(JSON.stringify(originalData));
    newSwagger.paths = {};

    // Clear definitions/components in new object, we will rebuild them
    if (newSwagger.definitions) newSwagger.definitions = {};
    if (newSwagger.components && newSwagger.components.schemas) newSwagger.components.schemas = {};

    const usedRefs = new Set();

    // 2. Identify Selected Paths
    endpoints.forEach(ep => {
        if (selectedIds.has(ep.id)) {
            if (!newSwagger.paths[ep.path]) {
                newSwagger.paths[ep.path] = {};
            }
            newSwagger.paths[ep.path][ep.method.toLowerCase()] = ep.data;

            // Scan for refs in this operation
            findRefs(ep.data, usedRefs);
        }
    });

    // 3. Recursively resolve refs
    const resolvedDefs = new Set();
    const refsQueue = Array.from(usedRefs);

    while (refsQueue.length > 0) {
        const ref = refsQueue.pop();
        if (resolvedDefs.has(ref)) continue;
        resolvedDefs.add(ref);

        const def = resolveRef(originalData, ref);
        if (def) {
            // Add to newSwagger
            addDefToSwagger(newSwagger, ref, def);

            // Scan this definition for more refs
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
    // Basic support for internal refs like #/definitions/Pet or #/components/schemas/Pet
    if (!ref.startsWith('#/')) return null; // External refs not supported in this simple version

    const parts = ref.split('/').slice(1); // Remove '#'
    let current = root;
    for (const part of parts) {
        current = current[part];
        if (!current) return null;
    }
    return current;
}

function addDefToSwagger(root, ref, defContent) {
    const parts = ref.split('/').slice(1);
    // Expected: ['definitions', 'Order'] or ['components', 'schemas', 'Order']

    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) current[part] = {};
        current = current[part];
    }
    const finalKey = parts[parts.length - 1];
    current[finalKey] = defContent;
}


// --- Export Logic ---

function exportJson() {
    const pruned = getPrunedSwagger();
    const timestamp = getTimestamp();
    const filename = `${currentFilename}-${timestamp}.json`;
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

            // Request Body (v3) or Body param (v2)
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

                    // inline schema if present
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

    // Models Section - Crucial for LLM understanding
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
    const filename = `${currentFilename}-${timestamp}.md`;
    downloadFile(md, filename, 'text/markdown');
}

function getTimestamp() {
    const now = new Date();
    // Format: YYYY-MM-DD-HH-MM-SS
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

// Start
init();
