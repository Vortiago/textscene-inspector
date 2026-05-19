/**
 * Generates HTML content for TSCN preview webview.
 */

import { sharedStyles } from '@textscene/core';

export function generateNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export interface WebviewHtmlOptions {
  scriptUri: string;
  nonce: string;
  /**
   * URI to the bundled CSS file emitted by esbuild-css-modules-plugin.
   * Optional because the file may not exist on first build before any
   * `.module.css` is imported; callers should pass it only when the file
   * is present.
   */
  cssUri?: string;
  /**
   * WI-R3F-1 feature flag. When true the webview entry mounts the empty
   * <TscnCanvas> React tree instead of the imperative TscnPreviewUI.
   * Controlled by the `textscene.useR3F` workspace setting.
   */
  useR3F: boolean;
  /**
   * The webview's CSP source (`webview.cspSource`). The CSP needs this
   * to allow loading the stylesheet via `<link>`.
   */
  cspSource: string;
}

export function generateWebviewHtml(options: WebviewHtmlOptions): string {
  const { scriptUri, nonce, cssUri, useR3F, cspSource } = options;
  const cssLink = cssUri
    ? `<link rel="stylesheet" nonce="${nonce}" href="${cssUri}">`
    : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${cspSource} blob: data:;">
      <title>TSCN Preview</title>
      ${cssLink}
      <style>
        /* Shared UI styles from core library */
        ${sharedStyles}

        /* App-specific layout styles */
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

        /* WI-R3F-1: container for the React-mounted canvas when useR3F=true. */
        #r3f-root {
          flex: 1;
          width: 100%;
          height: 100%;
          position: relative;
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

        /* VSCode-specific node details panel layout */
        #node-details-panel {
          border-top: 1px solid #3e3e42;
          padding: 1rem;
          background: #1e1e1e;
          font-size: 0.8125rem;
          display: none;
          max-height: 40vh;
          overflow-y: auto;
        }

        #node-details-panel.visible {
          display: block;
        }

        #node-details-panel h3 {
          font-size: 0.875rem;
          margin: 0 0 0.75rem 0;
          color: #ddd;
        }

        #details-content {
          overflow-y: auto;
        }
      </style>
    </head>
    <body>
      ${
        useR3F
          ? `<div id="r3f-root"></div>`
          : `
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
      </div>`
      }
      <script nonce="${nonce}">window.__TSCN_USE_R3F__ = ${useR3F};</script>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>
  `;
}
