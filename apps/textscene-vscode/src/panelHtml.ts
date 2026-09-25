/**
 * The preview panel's HTML document: where the bundle lives, and the settings
 * baked into the page at mount.
 */

import * as vscode from 'vscode';
import { generateWebviewHtml, generateNonce, type WebviewInitialConfig } from './webview/webviewHtml';

/**
 * Reads the settings the webview needs at mount, once per panel, into the HTML.
 * Like `nonce`, they are fixed for the panel's lifetime, so a change takes effect
 * on the next preview opened.
 */
function initialConfig(): WebviewInitialConfig {
  const viewportMode = vscode.workspace
    .getConfiguration('textscene')
    .get<'auto' | '2D' | '3D'>('defaultViewportMode', 'auto');
  return { viewportMode };
}

export function buildPanelHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  // The ESM build in `dist/webview/` keeps lazy chunks beside the entry script,
  // so they import each other through relative URIs.
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
