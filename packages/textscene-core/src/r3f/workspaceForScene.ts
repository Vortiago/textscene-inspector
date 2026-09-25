/**
 * Workspace selection from the scene root (ADR-0006 amendment), as the Godot editor
 * picks its main screen: CanvasItemEditor claims any CanvasItem, Node3DEditor any
 * Node3D, and a plain Node root neither. Light module: registry and type sets only.
 */

import type { TscnNode } from '../parser/types';
import type { ViewportMode } from './contexts/ViewportModeContext';
// The classification lives on the slice registrations, loaded here so the rule
// works whichever canvas, if any, imported them first.
import './nodes/index.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { is2DUIType } from './controls/has2DUIContent.js';
import { isViewportBoundary } from '../nodes/viewport/subviewport/viewportBoundary.js';

/**
 * A node Godot's CanvasItemEditor would claim: 2D world content or Control and
 * CanvasLayer UI. A caller that must see inside instanced sub-scenes feeds it nodes
 * from the **live scene tree** (`useLiveSceneNodes(isCanvasItemNode)`).
 */
export function isCanvasItemNode(node: TscnNode): boolean {
  return is2DUIType(node.type) || nodeComponentRegistry.isCanvasItem(node.type);
}

/**
 * The workspace the scene's root node claims, or null for a plain Node or an
 * unknown type, which keeps the current workspace.
 */
export function workspaceForRoot(root: TscnNode | undefined): ViewportMode | null {
  if (!root) return null;
  if (isCanvasItemNode(root)) {
    return '2D';
  }
  // A viewport is a plain `Node` that neither editor plugin handles, but it is
  // registered and non-container, so it would fall through to the Node3D arm (ADR-0033).
  if (isViewportBoundary(root.type)) {
    return null;
  }
  if (nodeComponentRegistry.get(root.type) && !nodeComponentRegistry.isContainer(root.type)) {
    return '3D';
  }
  return null;
}
