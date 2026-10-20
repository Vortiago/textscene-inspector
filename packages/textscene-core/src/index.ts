/**
 * The public entry point of `@textscene/core`, the TextScene Inspector library. It parses Godot .tscn files and renders
 * them with react-three-fiber. All visual and UI surface lives under `r3f/`. It re-exports only what a package
 * outside core imports, so no export here exists for core's own tests.
 */

export { TscnParser } from './parser/TscnParser';
export type { TscnNode } from './parser/types';

export { setLogAdapter, info, warn } from './logger';
export type { LogAdapter } from './logger';

export type { ResourceProvider } from './resources/ResourceProvider';
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

export { ResourceLoaderProvider } from './resources/ResourceLoaderContext';
export { ResourceLoader } from './resources/ResourceLoader';
export { createResourcePipeline } from './resources/createResourcePipeline';
export type { ResourcePipeline } from './resources/createResourcePipeline';
export type { CreateJobWorker, JobWorker } from './workers/WorkerJobRunner';
// A host that reads reported resource identities (a drop matcher keying on
// basename, say) needs the file half, which core cannot normalise on its behalf.
export { resourceFilePath } from './resources/subResourcePath';
