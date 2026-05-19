/**
 * TSCN Renderer - Main entry point
 *
 * This library provides parsing and rendering capabilities for Godot TSCN files.
 * It uses three.js for 3D rendering.
 */

// Export core functionality
export { TscnParser } from './parser/TscnParser';
export { TscnRenderer } from './core/TscnRenderer';
export { TscnPreviewUI } from './ui/TscnPreviewUI';
export { SceneTreeViewer } from './ui/SceneTreeViewer';
export { sharedStyles } from './ui/styles';
export { hashTscnNode, buildNodeHashMap } from './utils/nodeHash';

// Export logging
export { setLogAdapter, trace, debug, info, warn, error } from './logger';
export type { LogAdapter, LogLevel } from './logger';

// Export types
export type { TscnScene, TscnNode, MissingResource, ResourceNeededCallback } from './parser/types';
export type { TscnPreviewElements, TscnPreviewUIOptions } from './ui/TscnPreviewUI';
export type { SceneTreeViewerOptions } from './ui/SceneTreeViewer';
export type { CameraState, TscnRendererOptions } from './core/TscnRenderer';
export type { NodeChange, NodeChangeType, IncrementalUpdateData } from './types/changes';
export type { ResourceProvider } from './resources/ResourceProvider';

// Export resource provider utilities
export { isBinaryResourceType, stripResPrefix } from './resources/resourceProviderUtils';

// Export R3F components (Phase 14 migration, WI-R3F-1)
export { TscnCanvas, TscnSceneContents } from './r3f/TscnCanvas';
export type { TscnCanvasProps } from './r3f/TscnCanvas';

// Export the WI-R3F-2 resource hook + its provider/context
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
