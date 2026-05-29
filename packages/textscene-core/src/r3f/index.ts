export { TscnCanvas, TscnSceneContents, type TscnCanvasProps } from './TscnCanvas.js';
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
export { SceneInfoCard } from './components/SceneInfoCard/SceneInfoCard.js';
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
  type NodePathHandlers,
} from './hooks/useViewportSelection.js';
