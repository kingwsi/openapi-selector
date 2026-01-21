# OpenAPI / Swagger Selector

A modern, lightweight tool designed to help developers **import**, **filter**, and **export** subsets of OpenAPI (Swagger) definitions.

Build custom API specifications or generate focused documentation contexts for LLMs in seconds.

![Project Screenshot](https://raw.githubusercontent.com/kingwsi/openapi-selector/main/public/vite.svg)
*(Note: You can add a real screenshot here later)*

## ✨ Key Features

### 1. 📥 Flexible Import
- **Load via URL**: Directly fetch `swagger.json` from a remote URL.
- **Drag & Drop**: Upload local JSON or YAML files instantly.
- **Smart Parsing**: Automatically parses Swagger 2.0 and OpenAPI 3.0+ structures.

### 2. 🔍 Granular Filtering & Editing
- **Interactive Workspace**: View all endpoints grouped by Tags.
- **Smart Search**: Real-time filtering by path, method, or summary description.
- **Precise Selection**: Toggle individual endpoints, entire groups, or select all visible results.
- **Zero-Depedency Pruning**: The tool automatically calculates dependencies. If you select an endpoint, all related **Definitions** (v2) or **Schemas** (v3) are automatically included in the export.

### 3. 📤 Powerful Export Options
- **Export as JSON**: Generates a valid, fully functional OpenAPI JSON file containing *only* your selected endpoints and their required models. Perfect for creating "lite" versions of your API or mocking specific services.
- **Export as Markdown**: Generates a clean, context-optimized Markdown file. This is ideal for **feeding into LLMs (ChatGPT, Claude, etc.)** to provide strictly relevant API context without exceeding token limits.

## 🛠️ Technology Stack
- **Framework**: [Vue 3](https://vuejs.org/) (Composition API)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: Vanilla CSS (Scoped & Variables)
- **Deployment**: GitHub Pages (Automated via Actions)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kingwsi/openapi-selector.git
   cd openapi-selector
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```
   Access the app at `http://localhost:5173`.

4. **Build for production**
   ```bash
   npm run build
   ```

## 📄 License

MIT License. Free to use for personal and commercial projects.
