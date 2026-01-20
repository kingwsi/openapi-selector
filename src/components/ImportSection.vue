<script setup>
import { ref } from 'vue';

const emit = defineEmits(['dataLoaded']);

const url = ref('');
const isLoading = ref(false);
const errorMessage = ref('');
const isDragging = ref(false);
const fileInput = ref(null);

function showError(msg) {
  errorMessage.value = msg || '';
}

async function loadFromUrl() {
  const targetUrl = url.value.trim();
  if (!targetUrl) return showError("Please enter a URL.");

  showError(null);
  isLoading.value = true;

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    const data = await response.json();

    // Extract filename from URL
    let filename = 'remote-api';
    try {
      const urlObj = new URL(targetUrl);
      const pathParts = urlObj.pathname.split('/');
      let name = pathParts[pathParts.length - 1] || 'swagger';
      if (name.indexOf('.') !== -1) {
        name = name.substring(0, name.lastIndexOf('.'));
      }
      filename = name;
    } catch (e) {
      // ignore
    }

    emit('dataLoaded', { data, filename });
  } catch (err) {
    showError(`Failed to load URL: ${err.message}. Ensure CORS is enabled or use file upload.`);
  } finally {
    isLoading.value = false;
  }
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (file) processFile(file);
}

function onDrop(event) {
  isDragging.value = false;
  const file = event.dataTransfer.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  showError(null);
  const name = file.name;
  const filename = name.substring(0, name.lastIndexOf('.')) || name;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      emit('dataLoaded', { data, filename });
    } catch (err) {
      showError("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
}

function triggerFileInput() {
  fileInput.value.click();
}
</script>

<template>
  <section class="import-section">
    <div class="import-card">
      <div class="input-group">
        <label for="urlInput">Load via URL</label>
        <div class="input-wrapper">
          <input 
            type="url" 
            v-model="url" 
            placeholder="https://petstore.swagger.io/v2/swagger.json" 
            @keyup.enter="loadFromUrl"
          >
          <button 
            class="btn btn-primary" 
            @click="loadFromUrl" 
            :disabled="isLoading"
          >
            {{ isLoading ? 'Loading...' : 'Load' }}
          </button>
        </div>
      </div>

      <div class="divider">
        <span>OR</span>
      </div>

      <div 
        class="drop-zone" 
        :class="{ 'drag-over': isDragging }"
        @click="triggerFileInput"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
      >
        <div class="drop-content">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p>Drag & Drop your JSON file here</p>
          <p class="sub-text">or click to browse</p>
        </div>
        <input 
          type="file" 
          accept=".json,.yaml,.yml" 
          hidden 
          ref="fileInput" 
          @change="handleFileUpload"
        >
      </div>
      
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
    </div>
  </section>
</template>
