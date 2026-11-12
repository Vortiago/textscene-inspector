/**
 * The canvas space a Control gives the Node2D items below it. The Control walk solves where the
 * Control's canvas item sits and publishes that transform (`ControlYSortContext`); this group
 * applies it, so a Node2D below the Control composes through it as `get_global_transform()` does
 * (`control.cpp:719-737`, `canvas_item.cpp:176-186`). A hidden Control hides them too
 * (`canvas_item.cpp:62-64`).
 */
import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types';
import { isControlType } from './canvasPaintOrder.js';
import type { ControlProperties } from '../nodes/2d/ui/control/types.js';
import { useCanvasItemVisible } from './canvasItemVisible.js';
import { useControlTransform } from './contexts/ControlYSortContext.js';
import { threeMatrixFromTransform2D } from './node2dTransform.js';

interface ControlCanvasSpaceProps {
  node: TscnNode;
  /** The live path of `node`, which keys the published transform. */
  path: string;
  children: ReactNode;
}

function SolvedControlSpace({ node, path, children }: ControlCanvasSpaceProps) {
  const transform = useControlTransform(path);
  const matrix = useMemo(() => transform && threeMatrixFromTransform2D(transform), [transform]);
  const isVisible = useCanvasItemVisible(path, (node.properties as ControlProperties).visible);
  // paint-order-safe: outside every keyed item group, it only moves and hides the Node2D items below.
  return (
    <group visible={isVisible} {...(matrix ? { matrix, matrixAutoUpdate: false } : {})}>
      {children}
    </group>
  );
}

/** `children` as they are for a node that is no Control, which has no such space. */
export function ControlCanvasSpace({ node, path, children }: ControlCanvasSpaceProps) {
  if (!isControlType(node.type)) return <>{children}</>;
  return (
    <SolvedControlSpace node={node} path={path}>
      {children}
    </SolvedControlSpace>
  );
}
