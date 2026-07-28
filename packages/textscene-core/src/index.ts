/**
 * @textscene/core — public entry point for TextScene Inspector.
 *
 * The library parses Godot .tscn files and renders them with
 * react-three-fiber. The imperative renderer was removed;
 * all visual / UI surface lives under `r3f/`.
 */

// Parser + utilities
export { TscnParser } from './parser/TscnParser';

// Logging
export { setLogAdapter, trace, debug, info, warn, error } from './logger';
export type { LogAdapter, LogLevel } from './logger';

// Types
export type { TscnScene, TscnNode, MissingResource, ResourceNeededCallback } from './parser/types';
export type { NodeChange, NodeChangeType, IncrementalUpdateData } from './types/changes';
export type { ResourceProvider } from './resources/ResourceProvider';

// Resource provider utilities
export { isBinaryResourceType, stripResPrefix } from './resources/resourceProviderUtils';

// R3F UI (Phase 14)
export {
  TscnCanvas,
  TscnSceneContents,
  NodeDispatcher,
  type NodeDispatcherProps,
  nodeComponentRegistry,
  type NodeComponent,
  type NodeComponentProps,
  type NodeComponentRegistration,
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
  SceneTreeViewer,
  type SceneTreeViewerProps,
  NodeDetailsPanel,
  MissingResourcesPanel,
  type MissingResourcesPanelProps,
  ViewportSelector,
  type ViewportSelectorProps,
  type ViewportSelectorOption,
  TscnPreviewShell,
  type TscnPreviewShellProps,
  useViewportSelection,
  type UseViewportSelectionOptions,
  type UseViewportSelectionResult,
  type DelegatedPointerHandlers,
  parseTscnContent,
  type ParseResult,
  usePersistedState,
  readPersisted,
  writePersisted,
} from './r3f/index';

// Resource loading
export { useResource, useResourceLoader, resolveResourcePath } from './resources/useResource';
export type { ResourceResult, ResourceStatus, ResourceType } from './resources/useResource';
export {
  ResourceLoaderContext,
  ResourceLoaderProvider,
} from './resources/ResourceLoaderContext';
export type { ResourceLoaderProviderProps } from './resources/ResourceLoaderContext';
export { ResourceLoader } from './resources/ResourceLoader';
export { FileEventBus } from './resources/FileEventBus';
export type { FileData, FileLoadedHandler, FileFailedHandler } from './resources/FileEventBus';
export { createResourcePipeline } from './resources/createResourcePipeline';
export type { ResourcePipeline } from './resources/createResourcePipeline';
// A host fulfilling a **Sub-resource path** by upload (ADR-0022) keys bytes in
// its OWN provider, which core cannot normalise on its behalf — so the grammar's
// file half is public.
export { resourceFilePath } from './resources/subResourcePath';
