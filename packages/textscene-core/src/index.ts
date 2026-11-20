/**
 * The public entry point of `@textscene/core`, the TextScene Inspector library. It parses Godot .tscn files and renders
 * them with react-three-fiber. All visual and UI surface lives under `r3f/`. It re-exports only what a package
 * outside core imports, so no export here exists for core's own tests.
 */

export { TscnParser } from './parser/TscnParser';
export type { TscnNode } from './parser/types';

export { setLogAdapter, info, warn } from './logger';
export type { LogAdapter } from './logger';

export { isBinaryResourceType } from './resources/resourceProviderUtils';

export {
  useMissingResources,
  type MissingResourcesContextValue,
  TscnPreviewShell,
  PENDING_CAPTURE,
  type PreviewCaptureState,
  COMPACT_LAYOUT_QUERY,
  isCompactLayout,
  parseTscnContent,
  usePersistedState,
} from './r3f/index';

export { ResourceLoader } from './resources/ResourceLoader';
