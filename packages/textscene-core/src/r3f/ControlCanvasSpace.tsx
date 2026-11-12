/**
 * The canvas space a Control gives the Node2D items below it. The Control walk solves where the
 * Control's canvas item sits and publishes that transform (`ControlYSortContext`); this group
 * applies it, so a Node2D below the Control composes through it as `get_global_transform()` does
 * (`control.cpp:719-737`, `canvas_item.cpp:176-186`). A hidden Control hides them too
 * (`canvas_item.cpp:62-64`).
 */
import type { ReactNode } from 'react';
import type { TscnNode } from '../parser/types';
import type { ControlProperties } from '../nodes/2d/ui/control/types.js';
import { useAnimatedValueAt } from './contexts/AnimatedValueContext.js';
import { isControlType } from './canvasPaintOrder.js';
import { useControlTransform } from './contexts/ControlYSortContext.js';
import { threeMatrixFromTransform2D } from './node2dTransform.js';

interface ControlCanvasSpaceProps {
  node: TscnNode;
  /** The live path of `node`, which keys the published transform. */
  path: string;
  children: ReactNode;
}

function PlacedControlSpace({ node, path, children }: ControlCanvasSpaceProps) {
  const transform = useControlTransform(path);
  // A pushed `visible` takes the place of the authored one.
  const animatedVisible = useAnimatedValueAt(path, 'visible', (value) => value[0] !== 0);
  const isVisible = animatedVisible ?? (node.properties as ControlProperties).visible !== false;
  // paint-order-safe: outside every keyed item group, it only moves and hides the Node2D items below.
  return transform ? (
    <group matrix={threeMatrixFromTransform2D(transform)} matrixAutoUpdate={false} visible={isVisible}>
      {children}
    </group>
  ) : (
    <group visible={isVisible}>{children}</group>
  );
}

export function ControlCanvasSpace({ node, path, children }: ControlCanvasSpaceProps) {
  if (!isControlType(node.type)) return <>{children}</>;
  return (
    <PlacedControlSpace node={node} path={path}>
      {children}
    </PlacedControlSpace>
  );
}
