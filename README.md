# Swagger / OpenAPI Selector

A modern, static web application to filter and export specific endpoints from a Swagger (OpenAPI) definition file. 

Inspired by the clean aesthetics of Google's Antigravity design.

## Features

- **Import**: Load OpenAPI definitions via URL or Drag & Drop JSON files.
- **Search**: Real-time filtering by path, method, or summary.
- **Grouped View**: Endpoints are organized by tags, similar to Swagger UI.
- **Selection**: 
    - Select individual endpoints.
    - Select entire groups.
    - Select all matching search results.
- **Export**: Generate and download a valid, filtered `swagger.json` containing only the selected operations.

## Usage

1. **Host Locall**: Since this is a static HTML/JS app, you can open `index.html` directly in your browser (though some CORS restrictions might apply for URL fetching). 
   For best results, use a simple HTTP server:
   ```bash
   # Python 3
   python3 -m http.server 8000
   
   # Node.js
   npx http-server .
   ```
   Then navigate to `http://localhost:8000`.

2. **Load Data**:
   - Paste a URL to a `swagger.json` (e.g., `https://petstore.swagger.io/v2/swagger.json`).
   - OR Drag and drop a local `.json` file.

3. **Select & Export**:
   - Use the checkboxes to select the endpoints you need.
   - Click "Export Selected JSON" to download the filtered file.

## Deployment

This project is configured to deploy to **GitHub Pages** using GitHub Actions.

1. Push your code to GitHub.
2. Go to your repository **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.
4. The site will be deployed automatically on every push to the `main` branch.

## Customization

- **Styling**: `style.css` contains all the styles. The theme uses CSS variables for colors and radii, making it easy to reskin.
- **Logic**: `script.js` handles the parsing and filtering. It currently creates a shallow copy of the original JSON and prunes the `paths` object.

## License

MIT
