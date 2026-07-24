import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Modulate2DContext, multiplyModulate, useParentModulate } from '../../../r3f/canvasItemModulate';
import { Node2D } from '../../base/node2d/Component';
import type { CanvasModulateProperties } from './types';

/**
 * <CanvasModulate> — a Node2D whose ambient `color` multiplies onto its whole
 * subtree. It delegates ALL Node2D machinery (transform, `visible`, z /
 * draw-order, y-sort dispatch, `modulate`) to `<Node2D>` and only folds its
 * `color` into the inherited modulate.
 *
 * The color provider sits ABOVE `<Node2D>` (folding into what Node2D reads via
 * `useParentModulate`), NOT wrapping the children below it: `YSortDispatcher`
 * ignores its React `children` and re-dispatches `node.children`, so a
 * child-wrapped tint would be dropped whenever `y_sort_enabled=true`. Folding
 * above survives both paths, and `multiplyModulate` is component-wise
 * (commutative), so the non-y-sort result is identical to tinting below.
 *
 * `visible=false` therefore hides the subtree, matching Godot: CanvasModulate is
 * a CanvasItem, and `is_visible_in_tree()` ANDs up the parent chain, so a child
 * of a hidden CanvasModulate is not drawn (and its tint is disabled with it).
 */
export function CanvasModulate({ node, children }: NodeComponentProps) {
  const props = node.properties as CanvasModulateProperties;

  const parentModulate = useParentModulate();
  const modulate = useMemo(
    () => multiplyModulate(parentModulate, props.color),
    [parentModulate, props.color],
  );

  return (
    <Modulate2DContext.Provider value={modulate}>
      <Node2D node={node}>{children}</Node2D>
    </Modulate2DContext.Provider>
  );
}
