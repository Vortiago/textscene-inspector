/**
 * Generates the HTML shell for the preview webview: the CSP, the `#r3f-root` that
 * `r3f-webview-main.tsx` mounts into, and the script and stylesheet tags.
 */

/** The prefix of the cache's name (`resourceCacheName` in VS Code's `pre/service-worker.js`). */
const RESOURCE_CACHE_PREFIX = 'vscode-resource-cache-';

/** The bytes of a CSP nonce: 128 bits, the least the CSP specification recommends. */
const NONCE_BYTES = 16;

/**
 * A CSP nonce as hex, from `crypto.getRandomValues`.
 */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Extension-host settings the webview reads once at mount. A global, not a post,
 * since the shell needs them on its first render, before any round-trip lands.
 */
export interface WebviewInitialConfig {
  /** `textscene.defaultViewportMode`: a named mode seeds the viewport and turns auto-select off. */
  viewportMode: 'auto' | '2D' | '3D' | 'in-game';
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

/** Imports the entry script, and posts `webviewLoadFailed` when the import fails, as on a cut-off copy. */
function entryLoader(scriptUri: string): string {
  // Dropped from VS Code's resource cache first, or the new document would load the cut copy again.
  const dropCachedEntry = `Promise.resolve().then(() => caches.keys()).then((names) => Promise.all(names.filter((name) => name.startsWith(${scriptLiteral(RESOURCE_CACHE_PREFIX)})).map((name) => caches.open(name).then((cache) => cache.delete(${scriptLiteral(scriptUri)}))))).catch(() => {})`;
  // An entry that threw after it acquired the API leaves none to acquire, so its error goes to the console.
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

  // `script-src` admits the entry beside the loader. `worker-src blob:` admits our own workers (ADR-0042).
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
