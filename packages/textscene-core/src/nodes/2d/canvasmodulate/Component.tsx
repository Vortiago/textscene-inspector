import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';

/**
 * <CanvasModulate> is an ordinary Node2D here. Godot applies its `color` to the
 * whole canvas (`RS::canvas_set_modulate(canvas, color)`), wherever it sits, so
 * `canvasModulateColor` collects it and `<NodeDispatcher>` seeds the root modulate.
 * Folding it in here too would square it over this node's descendants.
 */
export function CanvasModulate({ node, children }: NodeComponentProps) {
  return <Node2D node={node}>{children}</Node2D>;
}
