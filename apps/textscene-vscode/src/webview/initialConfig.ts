/**
 * Reads the extension host's `window.__TEXTSCENE_CONFIG__` global (embedded
 * by `generateWebviewHtml`, see `webviewHtml.ts`) and resolves it into the
 * `initialViewportMode` prop `<TscnPreviewShell>` expects. Split out of
 * `r3f-webview-main.tsx` so this pure logic is testable without mounting
 * React — this package's vitest config runs in a Node environment, and the
 * webview itself only ever runs inside a real VS Code webview.
 */
import type { WebviewInitialConfig } from './webviewHtml.js';

/**
 * The subset of `TscnPreviewShellProps['initialViewportMode']` this host
 * ever passes through — kept as a local literal union (rather than importing
 * `@textscene/core`'s internal `ViewportMode` type) since only `'2D'`/`'3D'`
 * are meaningful overrides here.
 */
export type ForcedViewportMode = Exclude<WebviewInitialConfig['viewportMode'], 'auto'>;

/**
 * The host->webview config contract, reader side. Derived from
 * `WebviewInitialConfig` (the writer/serializer side in `webviewHtml.ts`) so
 * the two ends of this serialized contract can't drift apart — `Partial`
 * because `window.__TEXTSCENE_CONFIG__` may be entirely absent (the config
 * script is only embedded when `initialConfig` was passed to
 * `generateWebviewHtml`).
 */
export type TextSceneWebviewConfig = Partial<WebviewInitialConfig>;

export function readInitialConfig(): TextSceneWebviewConfig {
  return (
    (globalThis as { __TEXTSCENE_CONFIG__?: TextSceneWebviewConfig }).__TEXTSCENE_CONFIG__ ?? {}
  );
}

/**
 * `'auto'` (or an absent setting) leaves Godot-parity auto-select in control
 * — no override, so `undefined`. An explicit `'2D'`/`'3D'` passes through
 * unchanged for `<TscnPreviewShell initialViewportMode>` to seed and suppress
 * auto-select with.
 */
export function resolveInitialViewportMode(
  config: TextSceneWebviewConfig
): ForcedViewportMode | undefined {
  if (config.viewportMode === '2D' || config.viewportMode === '3D') {
    return config.viewportMode;
  }
  return undefined;
}
