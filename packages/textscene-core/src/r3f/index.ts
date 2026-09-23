export { TscnCanvas, TscnSceneContents } from './TscnCanvas.js';
export { NodeDispatcher, type NodeDispatcherProps } from './NodeDispatcher.js';
export { nodeComponentRegistry } from './NodeComponentRegistry.js';
export type {
  NodeComponent,
  NodeComponentProps,
  NodeComponentRegistration,
} from './NodeComponentRegistry.js';
// Ensure all node-type components self-register on first import.
import './nodes/index.js';

export {
  SelectionProvider,
  useSelection,
  HierarchyProvider,
  useHierarchy,
  CameraControlProvider,
  useCameraControl,
  useOptionalCameraControl,
  NodePathProvider,
  useNodePath,
  MissingResourcesProvider,
  useMissingResources,
  type SelectionContextValue,
  type SelectionProviderProps,
  type HierarchyContextValue,
  type HierarchyProviderProps,
  type CameraControlContextValue,
  type CameraControlProviderProps,
  type NodePathProviderProps,
  type MissingResourcesContextValue,
  type MissingResourcesProviderProps,
} from './contexts/index.js';

export {
  SceneTreeViewer,
  type SceneTreeViewerProps,
} from './components/SceneTreeViewer/SceneTreeViewer.js';
export { NodeDetailsPanel } from './components/NodeDetailsPanel/NodeDetailsPanel.js';
export {
  MissingResourcesPanel,
  type MissingResourcesPanelProps,
} from './components/MissingResourcesPanel/MissingResourcesPanel.js';
export {
  ViewportSelector,
  type ViewportSelectorProps,
  type ViewportSelectorOption,
} from './components/ViewportSelector/ViewportSelector.js';
export {
  TscnPreviewShell,
  type TscnPreviewShellProps,
} from './components/TscnPreviewShell/TscnPreviewShell.js';

export {
  useViewportSelection,
  type UseViewportSelectionOptions,
  type UseViewportSelectionResult,
  type DelegatedPointerHandlers,
} from './hooks/useViewportSelection.js';

// The debounced persistence `<TscnPreviewShell>` uses, for a host such as the web app's Source pane.
export { usePersistedState, readPersisted, writePersisted } from './hooks/usePersistedState.js';

// The shell's parse pipeline, so a host makes the same renderability decision the shell makes.
export { parseTscnContent, type ParseResult } from './hooks/useParsedScene.js';
