/**
 * Generates HTML content for TSCN preview webview.
 */

export function generateNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function generateWebviewHtml(scriptUri: string, nonce: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
      <title>TSCN Preview</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          overflow: hidden;
          background: #1e1e1e;
          color: #fff;
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          height: 100vh;
        }

        #tree-viewer-panel {
          width: 300px;
          background: #252526;
          border-right: 1px solid #3e3e42;
          display: flex;
          flex-direction: column;
        }

        #tree-viewer-header {
          padding: 0.75rem 1rem;
          background: #1e1e1e;
          border-bottom: 1px solid #3e3e42;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        #tree-viewer-header h2 {
          font-size: 0.875rem;
          font-weight: 600;
          flex: 1;
          margin: 0;
        }

        .tree-control-btn {
          width: auto;
          padding: 0.25rem 0.5rem;
          margin: 0;
          background: #3e3e42;
          border: none;
          color: #fff;
          border-radius: 3px;
          font-size: 0.75rem;
          cursor: pointer;
        }

        .tree-control-btn:hover {
          background: #555;
        }

        #tree-search {
          margin: 0.75rem;
          padding: 0.5rem;
          background: #3e3e42;
          border: 1px solid #555;
          color: #fff;
          border-radius: 4px;
          font-size: 0.875rem;
        }

        #tree-viewer-container {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem;
        }

        #canvas-container {
          flex: 1;
          position: relative;
        }

        #canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        .error {
          position: absolute;
          top: 10px;
          left: 10px;
          right: 10px;
          padding: 1rem;
          background: #5a1d1d;
          border: 1px solid #be1100;
          border-radius: 4px;
          font-size: 0.875rem;
          display: none;
        }

        .error.visible {
          display: block;
        }

        .scene-info {
          position: absolute;
          top: 10px;
          right: 10px;
          padding: 1rem;
          background: rgba(30, 58, 30, 0.9);
          border: 1px solid #2d5c2d;
          border-radius: 4px;
          font-size: 0.875rem;
          display: none;
        }

        .scene-info.visible {
          display: block;
        }

        .scene-info h3 {
          font-size: 1rem;
          margin-bottom: 0.5rem;
        }

        .scene-info p {
          margin: 0.25rem 0;
          color: #ccc;
        }

        /* Scene Tree Viewer Styles */
        .tree-root {
          font-size: 0.8125rem;
          user-select: none;
        }

        .tree-empty {
          padding: 1rem;
          text-align: center;
          color: #888;
        }

        .tree-node {
          margin: 0;
        }

        .tree-node-header {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.25rem 0.5rem;
          cursor: pointer;
          border-radius: 3px;
          transition: background-color 0.15s;
        }

        .tree-node-header:hover {
          background: #2a2d2e;
        }

        .tree-node-header.selected {
          background: #094771;
        }

        .tree-node-header.selected:hover {
          background: #0d5a8c;
        }

        .tree-expand-icon {
          width: 12px;
          font-size: 0.625rem;
          color: #ccc;
          cursor: pointer;
          flex-shrink: 0;
        }

        .tree-expand-spacer {
          width: 12px;
          text-align: center;
          font-size: 0.5rem;
          color: #555;
          flex-shrink: 0;
        }

        .tree-node-type {
          display: inline-block;
          padding: 0.125rem 0.375rem;
          border-radius: 3px;
          font-size: 0.625rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          flex-shrink: 0;
        }

        .type-node3d {
          background: #3e3e42;
          color: #ccc;
        }

        .type-mesh {
          background: #1e4d2b;
          color: #95e3b3;
        }

        .type-camera {
          background: #3d2e00;
          color: #ffcc00;
        }

        .type-light {
          background: #4d3319;
          color: #ffcc99;
        }

        .type-unknown {
          background: #2a1a2e;
          color: #c792ea;
        }

        .tree-node-name {
          flex: 1;
          color: #ddd;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .tree-transform-icon {
          color: #6c9;
          font-size: 0.75rem;
          flex-shrink: 0;
        }

        .tree-node-children {
          margin-left: 0;
        }

        /* Node Details Panel Styles */
        #node-details-panel {
          border-top: 1px solid #3e3e42;
          padding: 1rem;
          background: #1e1e1e;
          font-size: 0.8125rem;
          display: none;
        }

        #node-details-panel.visible {
          display: block;
        }

        #node-details-panel h3 {
          font-size: 0.875rem;
          margin: 0 0 0.75rem 0;
          color: #ddd;
        }

        .detail-row {
          display: flex;
          margin-bottom: 0.5rem;
        }

        .detail-label {
          color: #888;
          min-width: 70px;
          flex-shrink: 0;
        }

        .detail-value {
          color: #ddd;
          font-family: 'Consolas', 'Monaco', monospace;
          flex: 1;
          word-break: break-all;
        }

        .transform-section {
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px solid #3e3e42;
        }

        .transform-section h4 {
          font-size: 0.75rem;
          margin: 0 0 0.5rem 0;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .transform-grid {
          display: grid;
          grid-template-columns: 20px 1fr;
          gap: 0.375rem;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 0.75rem;
        }

        .transform-axis {
          color: #888;
          font-weight: bold;
        }

        .transform-value {
          color: #6c9;
        }
      </style>
    </head>
    <body>
      <div id="tree-viewer-panel">
        <div id="tree-viewer-header">
          <h2>Scene Tree</h2>
          <button class="tree-control-btn" id="expand-all-btn" title="Expand All">⊞</button>
          <button class="tree-control-btn" id="collapse-all-btn" title="Collapse All">⊟</button>
        </div>
        <input type="text" id="tree-search" placeholder="Search nodes..." />
        <div id="tree-viewer-container"></div>
        <div id="node-details-panel">
          <h3 id="details-node-name">No node selected</h3>
          <div id="details-content"></div>
        </div>
      </div>

      <div id="canvas-container">
        <div class="error" id="error-display">
          <strong>Error:</strong>
          <p id="error-message"></p>
        </div>

        <div class="scene-info" id="scene-info">
          <h3>Scene Info</h3>
          <p id="node-count">Nodes: 0</p>
          <p id="root-node">Root: None</p>
        </div>

        <canvas id="canvas"></canvas>
      </div>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>
  `;
}
