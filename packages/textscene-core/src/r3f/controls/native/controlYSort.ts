/**
 * What a y-sort needs from the Control walk and gives back to it. A Control sorts on the origin of
 * its canvas item (`control.cpp:719-736`), which only the rect solve knows, so
 * {@link controlTransformsOf} reads it off the solve, and {@link drawnPaintsOf} moves the paint
 * `buildSolveTree` gave in tree order to the runs the sort gave.
 * Pure data: no React, no THREE.
 */

import { VECTOR2_ZERO } from '../../../godot/math/vector';
import { transform2DFromParts } from '../../../godot/math/transform2d';
import { joinPath, relativeTo } from '../../../utils/nodePath';
import { ysortsChildren, type PaintRange } from '../../canvasPaintOrder';
import type { ControlTransforms } from '../../contexts/YSortContext';
import type { CanvasItemPaint } from '../../canvasItemPass/canvasItemPaint';
import { NO_SORT_INPUTS, sortedPaintOf, ySortedPaint, type SortItem } from '../../canvasItemPass/ySort';
import type { SolvedControl } from './controlRectSolver';
import { controlDrawTransformOf, controlItemOriginUnder } from './controlPixelSnap';
import { controlProps, type SolveNode } from './solveTree';

/** The rotation, scale and pivot `solved` leaves a Control, as the walker draws it. */
export function solvedDrawTransformOf(
  node: SolveNode,
  solved: Pick<SolvedControl, 'rect' | 'scale' | 'resetsChildTransform'>
) {
  return controlDrawTransformOf(controlProps(node), solved.rect, {
    resets: solved.resetsChildTransform === true,
    solvedScale: solved.scale,
  });
}

/**
 * The transform of every Control's canvas item in its parent: `_update_canvas_item_transform`
 * (`control.cpp:719-737`), whose origin is the position plus the pivot translation, whole pixels
 * when it snaps. A y-sort reads the origin of each item it sorts, and composes the whole transform
 * down a y-sorted item it merges.
 */
export function controlTransformsOf(
  tree: readonly SolveNode[],
  solved: ReadonlyMap<string, SolvedControl>,
  snapToPixels: boolean
): ControlTransforms {
  const transforms = new Map<string, ReturnType<typeof transform2DFromParts>>();
  const visit = (node: SolveNode): void => {
    const entry = solved.get(node.path);
    if (entry) {
      const draw = solvedDrawTransformOf(node, entry);
      const origin = controlItemOriginUnder(entry.rect, VECTOR2_ZERO, draw, snapToPixels);
      transforms.set(node.path, transform2DFromParts(draw.rotation, draw.scale, 0, origin));
    }
    node.children.forEach(visit);
  };
  tree.forEach(visit);
  return transforms;
}

/**
 * The world sort keys a node by its live path, and a viewport's forest holds paths relative to the
 * viewport (`livePath`, `''` for the root canvas). This keys `transforms` by live path.
 */
export function transformsAtLivePaths(livePath: string, transforms: ControlTransforms): ControlTransforms {
  if (livePath === '') return transforms;
  return new Map([...transforms].map(([path, transform]) => [joinPath(livePath, path), transform]));
}

/**
 * Each Control's paint as the walk draws it, by the forest's own path. `runs` holds the run of each
 * sorted entry by live path: the one sort of the canvas, which holds the forest's nodes once they are
 * in the shared live tree.
 */
export function drawnPaintsOf(
  tree: readonly SolveNode[],
  livePath: string,
  runs: ReadonlyMap<string, PaintRange>
): ReadonlyMap<string, CanvasItemPaint> {
  const paints = forestPaintsOf(tree);
  const own = runsOfForest(livePath, runs, paints);
  const drawn = new Map<string, CanvasItemPaint>();
  for (const [path, paint] of paints) drawn.set(path, sortedPaintOf(path, paint, own, paints));
  return drawn;
}

/**
 * The y-sort of a forest the shared live tree does not hold, a Control-only viewport or an unowned
 * scene-tile root: the one sort over the forest's own Controls, on the origins the solve gave them.
 */
export function forestSortedRuns(
  tree: readonly SolveNode[],
  origins: ControlTransforms
): ReadonlyMap<string, PaintRange> {
  const items = new Map<string, SortItem>();
  const visit = (node: SolveNode, parent: string | null): void => {
    const props = controlProps(node);
    items.set(node.path, {
      parent,
      isVisible: !node.hidden && props.visible !== false,
      fields: { ySortEnabled: ysortsChildren(node.node), local: null },
    });
    node.children.forEach((child) => visit(child, node.path));
  };
  tree.forEach((root) => visit(root, null));
  return ySortedPaint(items, forestPaintsOf(tree), { ...NO_SORT_INPUTS, origins });
}

/** Whether the shared live tree holds the forest's nodes, so the canvas's one sort covers them. */
export function isInSharedTree(
  tree: readonly SolveNode[],
  livePath: string,
  paints: ReadonlyMap<string, CanvasItemPaint>
): boolean {
  const root = tree[0];
  return root !== undefined && paints.has(livePath === '' ? root.path : joinPath(livePath, root.path));
}

/** The tree-order paint of every node of the forest, by its path. */
function forestPaintsOf(tree: readonly SolveNode[]): ReadonlyMap<string, CanvasItemPaint> {
  const paints = new Map<string, CanvasItemPaint>();
  const visit = (node: SolveNode): void => {
    paints.set(node.path, node.paint);
    node.children.forEach(visit);
  };
  tree.forEach(visit);
  return paints;
}

/** The runs of the forest's nodes, keyed by the forest's own paths. */
function runsOfForest(
  livePath: string,
  runs: ReadonlyMap<string, PaintRange>,
  paints: ReadonlyMap<string, CanvasItemPaint>
): ReadonlyMap<string, PaintRange> {
  if (livePath === '') return runs;
  const own = new Map<string, PaintRange>();
  for (const [path, run] of runs) {
    const relative = relativeTo(livePath, path);
    if (relative && paints.has(relative)) own.set(relative, run);
  }
  return own;
}
