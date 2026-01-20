<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  endpoints: {
    type: Array,
    required: true
  },
  selectedIds: {
    type: Set,
    required: true
  }
});

const emit = defineEmits(['update:selection']);
const searchQuery = ref('');

// --- Filtering ---
const filteredEndpoints = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return props.endpoints;

  return props.endpoints.filter(ep =>
    ep.path.toLowerCase().includes(query) ||
    ep.summary.toLowerCase().includes(query) ||
    ep.method.toLowerCase().includes(query)
  );
});

// --- Grouping ---
const groupedEndpoints = computed(() => {
  const groups = new Map();
  filteredEndpoints.value.forEach(ep => {
    const tag = (ep.tags && ep.tags.length > 0) ? ep.tags[0] : 'Default';
    if (!groups.has(tag)) {
      groups.set(tag, []);
    }
    groups.get(tag).push(ep);
  });
  
  // Sort by tag name
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tag, eps]) => ({
      tag,
      endpoints: eps,
      // Helper for UI state
      isCollapsed: false 
    }));
});

// --- Selection Logic ---
function toggleSelection(id) {
  if (props.selectedIds.has(id)) {
    props.selectedIds.delete(id);
  } else {
    props.selectedIds.add(id);
  }
}

function selectAll() {
  const idsInView = filteredEndpoints.value.map(ep => ep.id);
  const allSelected = idsInView.every(id => props.selectedIds.has(id));

  if (allSelected) {
    // Deselect all in view
    idsInView.forEach(id => props.selectedIds.delete(id));
  } else {
    // Select all in view
    idsInView.forEach(id => props.selectedIds.add(id));
  }
}

function resetSelection() {
  props.selectedIds.clear();
}

function toggleGroupSelection(groupEndpoints) {
  const ids = groupEndpoints.map(ep => ep.id);
  const allSelected = ids.every(id => props.selectedIds.has(id));

  if (allSelected) {
    ids.forEach(id => props.selectedIds.delete(id));
  } else {
    ids.forEach(id => props.selectedIds.add(id));
  }
}

// Stats
const selectedCount = computed(() => props.selectedIds.size);
const totalCount = computed(() => props.endpoints.length);

// Highlight Helper
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
}

function highlight(text) {
  if (!searchQuery.value) return text;
  const escapedQuery = escapeRegExp(searchQuery.value);
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<span class="highlight">$1</span>');
}
</script>

<template>
  <main class="workspace">
    
    <div class="toolbar">
      <div class="search-bar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" v-model="searchQuery" placeholder="Search paths, summary...">
      </div>
      <div class="actions">
        <div class="stats">
          <span>{{ selectedCount }}</span> / <span>{{ totalCount }}</span> Selected
        </div>
        <button @click="resetSelection" class="btn btn-ghost">Reset</button>
        <button @click="selectAll" class="btn btn-ghost">Select All</button>
      </div>
    </div>

    <div class="endpoints-container">
      <div class="endpoints-header">
        <div class="col-check"></div>
        <div class="col-method">Method</div>
        <div class="col-path">Path</div>
        <div class="col-summary">Description</div>
      </div>

      <div class="endpoints-list">
        <div v-if="filteredEndpoints.length === 0" style="padding: 2rem; text-align: center; color: var(--text-muted);">
          No matching endpoints found.
        </div>

        <div v-for="group in groupedEndpoints" :key="group.tag" class="group-container">
          <!-- Group Header -->
          <div class="group-header">
            <div class="group-title" @click="group.isCollapsed = !group.isCollapsed">
              <svg 
                width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                class="chevron" 
                :class="{ 'rotated': group.isCollapsed }"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              <span>{{ group.tag }}</span>
              <span class="group-count">{{ group.endpoints.length }}</span>
            </div>
            <div class="group-actions">
              <button class="btn-text" @click.stop="toggleGroupSelection(group.endpoints)">
                {{ group.endpoints.every(ep => selectedIds.has(ep.id)) ? 'Deselect All' : 'Select All' }}
              </button>
            </div>
          </div>

          <!-- Group Content -->
          <div class="group-content" :class="{ 'collapsed': group.isCollapsed }">
            <div 
              v-for="ep in group.endpoints" 
              :key="ep.id" 
              class="endpoint-item" 
              :class="{ 'selected': selectedIds.has(ep.id) }"
              @click="toggleSelection(ep.id)"
            >
              <div class="col-check">
                <input 
                  type="checkbox" 
                  :checked="selectedIds.has(ep.id)" 
                  @click.stop="toggleSelection(ep.id)"
                >
              </div>
              <div class="col-method">
                <span :class="['method-badge', `method-${ep.method}`]">{{ ep.method }}</span>
              </div>
              <div class="col-path" :title="ep.path" v-html="highlight(ep.path)"></div>
              <div class="col-summary" :title="ep.summary" v-html="highlight(ep.summary)"></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </main>
</template>
