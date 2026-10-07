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
import { drawsInWorkspace, isClaimedByCanvasItemEditor } from './nodeWorkspaceVisibility.js';

/**
 * The workspace the scene's root node claims, or null for a plain Node or an
 * unknown type, which keeps the current workspace.
 */
export function workspaceForRoot(root: TscnNode | undefined): ViewportMode | null {
  if (!root) return null;
  if (isClaimedByCanvasItemEditor(root.type)) return '2D';
  // Node3DEditor claims exactly what the 2D canvas refuses: registered 3D content.
  // A plain Node, an unknown type and a viewport pass through the 2D canvas, so
  // neither editor claims them.
  if (!drawsInWorkspace(root.type, '2d')) return '3D';
  return null;
}
