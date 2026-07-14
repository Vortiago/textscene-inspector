/**
 * Generates the HTML shell for the TSCN preview webview.
 *
 * The full UI lives in the React tree mounted inside `#r3f-root` by
 * `r3f-webview-main.tsx`. This file is just the CSP, body scaffolding,
 * and the script + linked-CSS tags.
 */

export function generateNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Extension-host settings the webview reads once at mount, before
 * `r3f-webview-main.tsx` renders `<TscnPreviewShell>`. Embedded as a global
 * (see `generateWebviewHtml`) rather than posted, since the shell needs the
 * value on its very first render — before any `postMessage` round-trip could
 * land.
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
   * URI to the CSS bundle emitted by `esbuild-css-modules-plugin`.
   * Optional because the file may not exist on first build before any
   * `.module.css` is imported; callers should pass it only when present.
   */
  cssUri?: string;
  /**
   * The webview's CSP source (`webview.cspSource`). The CSP needs this
   * to allow loading the stylesheet via `<link>`.
   */
  cspSource: string;
  /** Settings to expose to the webview at mount. Omit to skip the config script entirely. */
  initialConfig?: WebviewInitialConfig;
}

export function generateWebviewHtml(options: WebviewHtmlOptions): string {
  const { scriptUri, nonce, cssUri, cspSource, initialConfig } = options;
  const cssLink = cssUri
    ? `<link rel="stylesheet" nonce="${nonce}" href="${cssUri}">`
    : '';

  // `<` is escaped so a config value can never close this script tag early
  // (or open a new one) — defense in depth even though today's only field
  // (`viewportMode`) is a closed enum that can't carry it.
  const configScript = initialConfig
    ? `<script nonce="${nonce}">window.__TEXTSCENE_CONFIG__ = ${JSON.stringify(initialConfig).replace(/</g, '\\u003c')};</script>`
    : '';

  // The webview build emits ESM with code-splitting.
  // `<script type="module">` is required for dynamic `import()` to load
  // chunks; the CSP must also allow chunk URIs (the entry script's
  // module imports), which means `script-src` permits `${cspSource}`
  // in addition to the nonce'd entry. The nonce still applies to the
  // entry tag — chunk imports inherit the module context.
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource}; img-src ${cspSource} blob: data:;">
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
