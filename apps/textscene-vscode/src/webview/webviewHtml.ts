/**
 * Generates the HTML shell for the preview webview: the CSP, the `#r3f-root` that
 * `r3f-webview-main.tsx` mounts into, and the script and stylesheet tags.
 */

/** The bytes of a CSP nonce: 128 bits, the least the CSP specification recommends. */
const NONCE_BYTES = 16;

/** A CSP nonce as hex, from `crypto.getRandomValues`, which the Node and web extension hosts both provide. */
export function generateNonce(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
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

export function generateWebviewHtml(options: WebviewHtmlOptions): string {
  const { scriptUri, nonce, cssUri, cspSource, initialConfig } = options;
  const cssLink = cssUri ? `<link rel="stylesheet" nonce="${nonce}" href="${cssUri}">` : '';

  // `<` is escaped, so a config value never closes or opens a script tag. The
  // closed `viewportMode` enum cannot carry one, so this is defence in depth.
  const configScript = initialConfig
    ? `<script nonce="${nonce}">window.__TEXTSCENE_CONFIG__ = ${JSON.stringify(initialConfig).replace(/</g, '\\u003c')};</script>`
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
      <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>
  `;
}
