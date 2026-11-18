/**
 * Resolves the `window.__TEXTSCENE_CONFIG__` global `generateWebviewHtml` embeds
 * into `<TscnPreviewShell>`'s `initialViewportMode`. It is apart from
 * `r3f-webview-main.tsx`, so a node-environment test runs it without React.
 */
import type { WebviewInitialConfig } from './webviewHtml.js';

/** A local union, not core's internal `ViewportMode`: only the modes the setting names override. */
export type ForcedViewportMode = Exclude<WebviewInitialConfig['viewportMode'], 'auto'>;

/**
 * The reader side of the host->webview config, derived from the writer's
 * `WebviewInitialConfig` so the two ends agree. `Partial`, because the global is
 * absent when `generateWebviewHtml` got no `initialConfig`.
 */
export type TextSceneWebviewConfig = Partial<WebviewInitialConfig>;

export function readInitialConfig(): TextSceneWebviewConfig {
  return (globalThis as { __TEXTSCENE_CONFIG__?: TextSceneWebviewConfig }).__TEXTSCENE_CONFIG__ ?? {};
}

/** `'auto'` or no setting keeps auto-select, and a named mode seeds the viewport and turns it off. */
export function resolveInitialViewportMode(config: TextSceneWebviewConfig): ForcedViewportMode | undefined {
  const mode = config.viewportMode;
  return mode === '2D' || mode === '3D' || mode === 'in-game' ? mode : undefined;
}
