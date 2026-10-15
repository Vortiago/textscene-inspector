// Every node-type component registers itself on first import.
import './nodes/index.js';

export {
  useMissingResources,
  type MissingResourcesContextValue,
} from './contexts/MissingResourcesContext.js';
export { TscnPreviewShell } from './components/TscnPreviewShell/TscnPreviewShell.js';
export {
  PENDING_CAPTURE,
  type PreviewCaptureState,
} from './components/TscnPreviewShell/previewCaptureState.js';
// The shell's narrow-layout queries, so a host's own chrome switches at the same width.
export { COMPACT_LAYOUT_QUERY, isCompactLayout } from './components/TscnPreviewShell/narrowLayout.js';

// The debounced persistence `<TscnPreviewShell>` uses, for a host such as the web app's Source pane.
export { usePersistedState } from './hooks/usePersistedState.js';

// The shell's parse pipeline, so a host makes the same renderability decision the shell makes.
export { parseTscnContent } from './hooks/useParsedScene.js';
