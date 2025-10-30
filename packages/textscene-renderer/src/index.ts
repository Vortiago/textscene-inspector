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
export { hashTscnNode, buildNodeHashMap } from './utils/nodeHash';

// Export logging
export { setLogAdapter } from './logger';
export type { LogAdapter } from './logger';

// Export types
export type { TscnScene, TscnNode, MissingResource, ResourceNeededCallback } from './parser/types';
export type { TscnPreviewElements, TscnPreviewUIOptions } from './ui/TscnPreviewUI';
export type { SceneTreeViewerOptions } from './ui/SceneTreeViewer';
export type { CameraState, TscnRendererOptions } from './core/TscnRenderer';
export type { NodeChange, NodeChangeType, IncrementalUpdateData } from './types/changes';
export type { ResourceProvider } from './resources/ResourceProvider';

// Export resource provider utilities
export { isBinaryResourceType, stripResPrefix } from './resources/resourceProviderUtils';
