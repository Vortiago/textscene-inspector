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
 * The workspace the scene's root node claims, or null when no workspace
 * claims it (plain Node / unknown types — keep the current workspace).
 */
export function workspaceForRoot(root: TscnNode | undefined): ViewportMode | null {
  if (!root) return null;
  if (nodeComponentRegistry.isCanvasItem(root.type) || TWO_D_UI_TYPES.has(root.type)) {
    return '2D';
  }
  if (nodeComponentRegistry.get(root.type) && !nodeComponentRegistry.isContainer(root.type)) {
    return '3D';
  }
  return null;
}

/**
 * True when any node in the subtree is CanvasItem content — Control/
 * CanvasLayer UI or 2D world nodes (sprites, tilemaps…). Drives the
 * "switch to 2D" hint: in the 3D workspace that content is invisible.
 */
export function hasCanvasContent(nodes: readonly TscnNode[]): boolean {
  for (const node of nodes) {
    if (TWO_D_UI_TYPES.has(node.type) || nodeComponentRegistry.isCanvasItem(node.type)) {
      return true;
    }
    if (hasCanvasContent(node.children)) return true;
  }
  return false;
}
