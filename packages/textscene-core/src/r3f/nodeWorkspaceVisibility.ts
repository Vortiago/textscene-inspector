/**
 * Which of the two render canvases draws a node type (ADR-0006 amendment): the 3D
 * viewport never draws CanvasItems, and the 2D canvas never draws 3D content. A
 * plain or unregistered container, such as a `Node` root, passes through both.
 */

import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { is2DUIType } from './controls/has2DUIContent.js';
import {
  isViewportBoundary,
  isViewportSurface,
} from '../nodes/viewport/subviewport/viewportBoundary.js';
import type { CanvasWorkspace } from './contexts/CanvasWorkspaceContext.js';

/**
 * A SubViewportContainer is a Control, but not a CanvasItem here: its
 * sub-viewport's 3D content draws in Godot's 3D view, sharing World3D unless
 * `own_world_3d` (ADR-0030).
 */
export function isCanvasItemNode(type: string): boolean {
  return (
    !isViewportSurface(type) && (nodeComponentRegistry.isCanvasItem(type) || is2DUIType(type))
  );
}

export function drawsInWorkspace(type: string, workspace: CanvasWorkspace): boolean {
  const canvasItem = isCanvasItemNode(type);
  if (workspace === '3d') return !canvasItem;
  // A sub-viewport renders offscreen, and a `ViewportTexture` consumer here needs
  // its target, so it mounts in both. The component portals its subtree into a
  // detached scene, so it never reaches this canvas (ADR-0030).
  return (
    canvasItem ||
    isViewportBoundary(type) ||
    !nodeComponentRegistry.get(type) ||
    nodeComponentRegistry.isContainer(type)
  );
}
