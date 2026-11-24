/**
 * Workspace selection from the scene root (ADR-0006 amendment), as the Godot editor
 * picks its main screen: CanvasItemEditor claims any CanvasItem, Node3DEditor any
 * Node3D, and a plain Node root neither. Light module: registry and type sets only.
 */

import type { ViewportMode } from './viewportMode.js';
// The classification lives on the slice registrations, loaded here so the rule
// works whichever canvas, if any, imported them first.
import './nodes/index.js';
import { isClaimedByCanvasItemEditor, isClaimedByNode3DEditor } from './nodeWorkspaceVisibility.js';

/** Null for a plain Node, an unknown type or no root, which keeps the current workspace. */
export function workspaceForRootType(rootType: string | null): ViewportMode | null {
  if (rootType === null) return null;
  if (isClaimedByCanvasItemEditor(rootType)) return '2D';
  if (isClaimedByNode3DEditor(rootType)) return '3D';
  return null;
}
