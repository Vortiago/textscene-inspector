/**
 * Godot-editor workspace selection (ADR-0006 amendment): the editor picks the
 * main screen from the node a plugin claims — CanvasItemEditor handles any
 * CanvasItem (Node2D/Control), Node3DEditor handles Node3D, and a plain Node
 * root is claimed by neither (the editor stays where it was). We mirror that
 * rule against the scene ROOT node. Light module: registry + type sets only.
 */

import type { TscnNode } from '../parser/types';
import type { ViewportMode } from './contexts/ViewportModeContext';
// The classification lives on the slice registrations — load them so the
// rule works regardless of which canvas (if any) imported them first.
import './nodes/index.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { TWO_D_UI_TYPES } from './controls/has2DUIContent.js';

/**
 * A node Godot's CanvasItemEditor would claim — 2D world content (Node2D,
 * sprites, tilemaps…) or Control/CanvasLayer UI. The shared predicate behind
 * both the root-workspace rule and the "scene has 2D content" hint, so the
 * classification lives in one place. Callers that must see content inside
 * instanced sub-scenes feed effective nodes from the **live scene tree**
 * (`useLiveSceneNodes(isCanvasItemNode)`) rather than a static walk.
 */
export function isCanvasItemNode(node: TscnNode): boolean {
  return TWO_D_UI_TYPES.has(node.type) || nodeComponentRegistry.isCanvasItem(node.type);
}

/**
 * The workspace the scene's root node claims, or null when no workspace
 * claims it (plain Node / unknown types — keep the current workspace).
 */
export function workspaceForRoot(root: TscnNode | undefined): ViewportMode | null {
  if (!root) return null;
  if (isCanvasItemNode(root)) {
    return '2D';
  }
  if (nodeComponentRegistry.get(root.type) && !nodeComponentRegistry.isContainer(root.type)) {
    return '3D';
  }
  return null;
}
