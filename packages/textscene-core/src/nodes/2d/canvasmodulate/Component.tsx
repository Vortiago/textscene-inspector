import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';

/**
 * <CanvasModulate> — a Node2D whose `color` multiplies onto the whole CANVAS,
 * not onto its own subtree. Godot applies it as
 * `RS::canvas_set_modulate(canvas, color)` when the node enters the canvas, so
 * where it sits in the tree does not matter and it needs no children at all to
 * have an effect — the isometric dungeon's is a childless leaf beside the level,
 * which a subtree reading of it turns into a no-op.
 *
 * The colour is therefore collected once per canvas by `canvasModulateColor`
 * and seeded into the root modulate by `<NodeDispatcher>`; folding it in again
 * here would square it over this node's own descendants. What is left is an
 * ordinary Node2D: transform, `visible`, draw order, y-sort dispatch, modulate.
 *
 * `visible = false` still hides the subtree, matching Godot — CanvasModulate is
 * a CanvasItem, so `is_visible_in_tree()` ANDs up the parent chain — and it also
 * withdraws the canvas tint, which the same collector handles.
 */
export function CanvasModulate({ node, children }: NodeComponentProps) {
  return <Node2D node={node}>{children}</Node2D>;
}
