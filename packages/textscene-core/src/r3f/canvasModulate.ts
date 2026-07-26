/**
 * Which `CanvasModulate` colour is in force for a canvas.
 *
 * A CanvasModulate does NOT tint its own subtree — it tints the whole canvas it
 * belongs to. Godot implements it as `RS::canvas_set_modulate(canvas, color)`
 * on ENTER_CANVAS, so the node's position in the tree is irrelevant and only
 * membership in the canvas matters. The isometric dungeon relies on exactly
 * that: its CanvasModulate is a CHILDLESS leaf beside the level, so a
 * subtree-scoped reading of it tints nothing at all.
 *
 * Two consequences of the "on enter" mechanism, both reproduced here:
 *   - Several CanvasModulates on one canvas do not compose; the LAST to enter
 *     wins, which is document (pre-order) order.
 *   - A hidden one does not apply. It is a CanvasItem, so `is_visible_in_tree()`
 *     gates it, and a hidden ancestor hides it with them.
 *
 * A `CanvasLayer` is its own canvas, so the walk does not descend into one.
 */

import type { TscnNode } from '../parser/types.js';
import { WHITE_MODULATE, type RGBA } from './canvasItemModulate.js';

interface CanvasModulateLike {
  color?: RGBA;
  visible?: boolean;
}

/**
 * The canvas-wide tint for a scene's root nodes — white when the scene has no
 * (visible) CanvasModulate, which is the identity for the modulate product.
 *
 * KNOWN GAP: the walk sees authored nodes only, so a CanvasModulate living
 * inside an instanced sub-scene is not found. Godot would apply it.
 */
export function canvasModulateColor(nodes: readonly TscnNode[]): RGBA {
  let found: RGBA | null = null;

  const walk = (node: TscnNode, visible: boolean): void => {
    const props = node.properties as CanvasModulateLike;
    const shown = visible && props.visible !== false;
    // Not a CanvasItem: a CanvasLayer hosts its own canvas, which any
    // CanvasModulate inside it would tint instead of this one.
    if (node.type === 'CanvasLayer') return;
    if (node.type === 'CanvasModulate' && shown && props.color) found = props.color;
    for (const child of node.children) walk(child, shown);
  };

  for (const node of nodes) walk(node, true);
  return found ?? WHITE_MODULATE;
}
