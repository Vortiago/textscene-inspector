/**
 * Generates the HTML shell for the preview webview: the CSP, the `#r3f-root` that
 * `r3f-webview-main.tsx` mounts into, and the script and stylesheet tags.
 */

import { webcrypto } from 'node:crypto';
import { RESOURCE_CACHE_PREFIX } from './dropCachedResource';

/** The bytes of a CSP nonce: 128 bits, the least the CSP specification recommends. */
const NONCE_BYTES = 16;

/**
 * A CSP nonce as hex, from `crypto.getRandomValues`. The module, not the global: Node 18, under the
 * `engines.vscode` floor, has no global `crypto`. The web build aliases the module to `webCrypto.browser.ts`.
 */
export function generateNonce(): string {
  const bytes = webcrypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Extension-host settings the webview reads once at mount. A global, not a post,
 * since the shell needs them on its first render, before any round-trip lands.
 */
export interface WebviewInitialConfig {
  /**
   * `textscene.defaultViewportMode`. `'auto'` leaves Godot-parity auto-select
   * (ADR-0006) in control; an explicit `'2D'`/`'3D'` seeds the viewport and
   * suppresses auto-select for this panel (see `TscnPreviewShell`'s
   * `initialViewportMode` prop).
   */
  viewportMode: 'auto' | '2D' | '3D';
}

export interface WebviewHtmlOptions {
  scriptUri: string;
  nonce: string;
  /**
   * URI to the CSS bundle `esbuild-css-modules-plugin` emits. Absent until some
   * `.module.css` is imported, so a caller passes it only when present.
   */
  cssUri?: string;
  /**
   * The webview's CSP source (`webview.cspSource`), which lets the CSP load the
   * stylesheet through `<link>`.
   */
  cspSource: string;
  /** Settings to expose to the webview at mount. Omit to skip the config script entirely. */
  initialConfig?: WebviewInitialConfig;
}

/**
 * `value` as a JavaScript literal for an inline script. `<` is escaped, so a value never
 * closes or opens a script tag: an HTML parser ends a script only on a literal `</script`.
 */
function scriptLiteral(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Imports the entry script, and tells the host when the import fails, such as on a cut-off
 * copy (`webviewLoadFailed`). The failed copy leaves VS Code's resource cache first, or the
 * new document the host loads would get it again (`dropCachedResource`). An entry that threw
 * after it acquired the API leaves none to acquire, so that error goes to the console
 * instead of being replaced by the acquire's.
 */
function entryLoader(scriptUri: string): string {
  const dropCachedEntry = `Promise.resolve().then(() => caches.keys()).then((names) => Promise.all(names.filter((name) => name.startsWith(${scriptLiteral(RESOURCE_CACHE_PREFIX)})).map((name) => caches.open(name).then((cache) => cache.delete(${scriptLiteral(scriptUri)}))))).catch(() => {})`;
  const reportFailure = `try { acquireVsCodeApi().postMessage({ type: 'webviewLoadFailed', error: String(error) }); } catch { console.error(error); }`;
  return `import(${scriptLiteral(scriptUri)}).catch((error) => ${dropCachedEntry}.then(() => { ${reportFailure} }));`;
}

export function generateWebviewHtml(options: WebviewHtmlOptions): string {
  const { scriptUri, nonce, cssUri, cspSource, initialConfig } = options;
  const cssLink = cssUri ? `<link rel="stylesheet" nonce="${nonce}" href="${cssUri}">` : '';

  // The closed `viewportMode` enum cannot carry a `<`, so its escape is defence in depth.
  const configScript = initialConfig
    ? `<script nonce="${nonce}">window.__TEXTSCENE_CONFIG__ = ${scriptLiteral(initialConfig)};</script>`
    : '';

  // Dynamic `import()` of the ESM chunks needs `<script type="module">`, and
  // `script-src` permits `${cspSource}` for the chunk URIs beside the nonce'd
  // entry. Chunk imports inherit the entry's module context. `worker-src blob:`
  // admits only workers built from the bundle's own code (ADR-0042).
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource}; img-src ${cspSource} blob: data:; worker-src blob:;">
      <title>TextScene Inspector</title>
      ${cssLink}
      <link rel="modulepreload" nonce="${nonce}" href="${scriptUri}">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          overflow: hidden;
          background: #1e1e1e;
          color: #fff;
          font-family: system-ui, -apple-system, sans-serif;
          height: 100vh;
        }
        #r3f-root {
          width: 100vw;
          height: 100vh;
          display: block;
        }
      </style>
    </head>
    <body>
      <div id="r3f-root"></div>
      ${configScript}
      <script type="module" nonce="${nonce}">${entryLoader(scriptUri)}</script>
    </body>
    </html>
  `;
}
