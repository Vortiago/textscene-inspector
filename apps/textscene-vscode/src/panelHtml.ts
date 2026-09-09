/**
 * The preview panel's HTML document: where the bundle lives, and the settings
 * baked into the page at mount.
 */

import * as vscode from 'vscode';
import { generateWebviewHtml, generateNonce, type WebviewInitialConfig } from './webview/webviewHtml';

/**
 * Read the settings the webview needs at mount. Read once per panel
 * creation (baked into the HTML, not reactive) — like `nonce`, this is
 * fixed for the panel's lifetime; a setting change takes effect on the
 * next preview opened, not the current one.
 */
function initialConfig(): WebviewInitialConfig {
  const viewportMode = vscode.workspace
    .getConfiguration('textscene')
    .get<'auto' | '2D' | '3D'>('defaultViewportMode', 'auto');
  return { viewportMode };
}

export function buildPanelHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  // The webview build lives in `dist/webview/` (ESM + splitting)
  // so lazy-loaded chunks live alongside the entry script and import
  // each other via relative URIs.
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'webview.js')
  ).toString();
  const cssUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'webview.css')
  ).toString();

  const nonce = generateNonce();
  return generateWebviewHtml({
    scriptUri,
    cssUri,
    nonce,
    cspSource: webview.cspSource,
    initialConfig: initialConfig(),
  });
}
