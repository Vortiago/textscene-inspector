/**
 * Which of the two render canvases draws a node type (ADR-0006 amendment): the 3D
 * viewport never draws CanvasItems, and the 2D canvas never draws 3D content. A
 * plain or unregistered container, such as a `Node` root, passes through both.
 */

import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { is2DUIType } from './controls/has2DUIContent.js';
import { isViewportBoundary, isViewportSurface } from '../nodes/viewport/subviewport/viewportBoundary.js';
import type { CanvasWorkspace } from './contexts/CanvasWorkspaceContext.js';

/** A type Godot's CanvasItemEditor would claim: 2D world content or Control and CanvasLayer UI. */
export function isClaimedByCanvasItemEditor(type: string): boolean {
  return is2DUIType(type) || nodeComponentRegistry.isCanvasItem(type);
}

/**
 * A SubViewportContainer is a Control, but not a CanvasItem here: its
 * sub-viewport's 3D content draws in Godot's 3D view, sharing World3D unless
 * `own_world_3d` (ADR-0033).
 */
function drawsAsCanvasItem(type: string): boolean {
  return !isViewportSurface(type) && isClaimedByCanvasItemEditor(type);
}

/**
 * A type Godot's Node3DEditor would claim: registered 3D content. A plain Node, an
 * unknown type and a viewport are claimed by neither editor (ADR-0033).
 */
export function isClaimedByNode3DEditor(type: string): boolean {
  return (
    !isClaimedByCanvasItemEditor(type) &&
    !isViewportBoundary(type) &&
    !nodeComponentRegistry.passesThrough(type)
  );
}

export function drawsInWorkspace(type: string, workspace: CanvasWorkspace): boolean {
  if (workspace === '3d') return !drawsAsCanvasItem(type);
  // The 2D canvas mounts all but 3D content. A sub-viewport mounts in both: a
  // `ViewportTexture` consumer here needs its target, and its component portals its
  // subtree into a detached scene, so it never reaches this canvas (ADR-0033).
  return !isClaimedByNode3DEditor(type);
}
