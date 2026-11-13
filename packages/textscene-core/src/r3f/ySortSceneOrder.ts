/**
 * Where scene order puts the draw-sequence runs below a y-sorted node. `buildSolveTree` gives the
 * Control subtrees their runs in that order, so the y-sort states each shift from it. Pure data: no
 * React, no THREE.
 */

import type { TscnNode } from '../parser/types.js';
import { joinPath } from '../utils/nodePath.js';
import { perObject } from '../utils/perObject.js';
import { allocateNodePaintRange, ysortsChildren, type PaintRange } from './canvasPaintOrder.js';
import { isControlType } from './canvasItemClass.js';

/**
 * The base of the run scene order gives each node below `node`, by path: its children, and the
 * children of each y-sorted child, which the sort merges into one list. Another child is one item,
 * and its run holds its whole subtree.
 */
export function sceneOrderBasesBelow(
  node: TscnNode,
  range: PaintRange,
  path: string,
  bases: Map<string, number> = new Map()
): Map<string, number> {
  const allocated = allocateNodePaintRange(range, node);
  node.children.forEach((child, i) => {
    const run = allocated.children[i]!;
    const childPath = joinPath(path, child.name);
    bases.set(childPath, run.base);
    if (ysortsChildren(child)) sceneOrderBasesBelow(child, run, childPath, bases);
  });
  return bases;
}

/** Whether `node` or a node below it is a Control, so a Control subtree moves with it. */
export const hasControl: (node: TscnNode) => boolean = perObject(
  (node) => isControlType(node.type) || node.children.some(hasControl)
);
