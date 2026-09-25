/**
 * Resolves the `window.__TEXTSCENE_CONFIG__` global `generateWebviewHtml` embeds
 * into `<TscnPreviewShell>`'s `initialViewportMode`. It is apart from
 * `r3f-webview-main.tsx`, so a node-environment test runs it without React.
 */
import type { WebviewInitialConfig } from './webviewHtml.js';

/**
 * The subset of `TscnPreviewShellProps['initialViewportMode']` this host passes:
 * a local union, not core's internal `ViewportMode`, since only `'2D'`/`'3D'`
 * override.
 */
export type ForcedViewportMode = Exclude<WebviewInitialConfig['viewportMode'], 'auto'>;

/**
 * The reader side of the host->webview config, derived from the writer's
 * `WebviewInitialConfig` so the two ends agree. `Partial`, because the global is
 * absent when `generateWebviewHtml` got no `initialConfig`.
 */
export type TextSceneWebviewConfig = Partial<WebviewInitialConfig>;

export function readInitialConfig(): TextSceneWebviewConfig {
  return (
    (globalThis as { __TEXTSCENE_CONFIG__?: TextSceneWebviewConfig }).__TEXTSCENE_CONFIG__ ?? {}
  );
}

/**
 * `'auto'` or an absent setting gives `undefined`, which keeps Godot-parity
 * auto-select. `'2D'`/`'3D'` passes through to seed the viewport and suppress it.
 */
export function resolveInitialViewportMode(
  config: TextSceneWebviewConfig
): ForcedViewportMode | undefined {
  if (config.viewportMode === '2D' || config.viewportMode === '3D') {
    return config.viewportMode;
  }
  return undefined;
}
