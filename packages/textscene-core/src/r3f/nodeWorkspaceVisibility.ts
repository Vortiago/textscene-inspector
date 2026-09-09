/**
 * Which of the two render canvases draws a given node type.
 *
 * Godot editor workspace split (ADR-0006 amendment): the 3D viewport never
 * draws CanvasItems (Node2D world, Control UI, CanvasLayer subtrees); the
 * 2D world canvas never draws registered 3D content. Plain/unregistered
 * containers (e.g. a `Node` root) pass through in both so children of
 * either kind stay reachable.
 */

import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { is2DUIType } from './controls/has2DUIContent.js';
import {
  isViewportBoundary,
  isViewportSurface,
} from '../nodes/viewport/subviewport/viewportBoundary.js';
import type { CanvasWorkspace } from './contexts/CanvasWorkspaceContext.js';

/**
 * A viewport surface (SubViewportContainer) is a Control, so `is2DUIType`
 * claims it — but it must NOT count as a CanvasItem here, or a contained
 * sub-viewport's 3D content goes with it, and that content really does draw
 * in Godot's 3D view (shared World3D unless `own_world_3d`). ADR-0030.
 */
export function isCanvasItemNode(type: string): boolean {
  return (
    !isViewportSurface(type) && (nodeComponentRegistry.isCanvasItem(type) || is2DUIType(type))
  );
}

export function drawsInWorkspace(type: string, workspace: CanvasWorkspace): boolean {
  const canvasItem = isCanvasItemNode(type);
  if (workspace === '3d') return !canvasItem;
  // A sub-viewport is not drawn by either canvas — it renders OFFSCREEN, and
  // a `ViewportTexture` consumer in this workspace (a Sprite2D showing a 3D
  // sub-scene) needs that target. Dropping it here would mean the publisher
  // never mounts, so the texture could never resolve. Its subtree still
  // never reaches this canvas: the component portals it into a detached
  // scene rather than rendering it inline. ADR-0030.
  return (
    canvasItem ||
    isViewportBoundary(type) ||
    !nodeComponentRegistry.get(type) ||
    nodeComponentRegistry.isContainer(type)
  );
}
