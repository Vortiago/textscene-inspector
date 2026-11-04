/**
 * What the live tree says about the update mode of a SubViewport: a SubViewportContainer parent
 * replaces the authored mode, and the viewport the node sits in decides a WHEN_PARENT_VISIBLE pass.
 */
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes.js';
import { SubViewportUpdateMode } from '../../../godot/scene/viewport.js';
import { isShownCanvasNode } from '../../../r3f/canvasScopes.js';
import { isCanvasLayerType } from '../../../r3f/canvasPaintOrder.js';
import type { LiveTree } from '../../../r3f/liveSceneTree.js';
import { parentPathOf } from '../../../utils/nodePath.js';
import { isViewportBoundary } from './viewportBoundary.js';

/** What the live tree says of a SubViewport's update mode. */
export interface ViewportGate {
  /** The mode the pass renders by. */
  updateMode: number;
  /** The viewport the node sits in, null at the root viewport. */
  enclosingPath: string | null;
}

export function viewportGateAt(tree: LiveTree, path: string, authoredMode: number): ViewportGate {
  return {
    updateMode: effectiveUpdateModeAt(tree, path, authoredMode),
    enclosingPath: enclosingViewportPathAt(tree, path),
  };
}

/**
 * The mode `path` renders by. A SubViewportContainer parent sets ALWAYS while it is visible in
 * the tree and DISABLED while it is not (`subviewport_container.cpp:116-128`), whatever the
 * authored mode says.
 */
function effectiveUpdateModeAt(tree: LiveTree, path: string, authoredMode: number): number {
  const parentPath = parentPathOf(path);
  if (parentPath === null || tree.at(parentPath)?.step.node.type !== 'SubViewportContainer') {
    return authoredMode;
  }
  return isVisibleInTree(tree, parentPath) ? SubViewportUpdateMode.ALWAYS : SubViewportUpdateMode.DISABLED;
}

/** The path of the nearest SubViewport above `path`, null at the root viewport. */
function enclosingViewportPathAt(tree: LiveTree, path: string): string | null {
  for (let above = parentPathOf(path); above !== null; above = parentPathOf(above)) {
    const node = tree.at(above)?.step.node;
    if (node && isViewportBoundary(node.type)) return above;
  }
  return null;
}

/**
 * `CanvasItem::is_visible_in_tree()`: the node's own `visible` and the visibility of its parent.
 * The climb ends at a parent that is no CanvasItem. A CanvasLayer answers with its own
 * `visible` and a Node answers true (`canvas_item.cpp:330-350`).
 */
function isVisibleInTree(tree: LiveTree, path: string): boolean {
  const node = tree.at(path)?.step.node;
  if (!node || !isShownCanvasNode(node)) return false;
  const parentPath = parentPathOf(path);
  const parent = parentPath === null ? undefined : tree.at(parentPath)?.step.node;
  if (!parent) return true;
  if (isCanvasLayerType(parent.type)) return isShownCanvasNode(parent);
  return !descendsFromClass(parent.type, 'CanvasItem') || isVisibleInTree(tree, parentPath!);
}
