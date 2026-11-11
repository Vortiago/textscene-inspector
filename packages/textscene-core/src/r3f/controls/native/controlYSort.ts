/**
 * The y-sort of a Control's children, which the rect solve has to place first: a Control sorts on
 * the origin of its canvas item (`control.cpp:719-736`), so the order is known only after the
 * solve. {@link sortYSortedControls} re-packs the draw-sequence runs `buildSolveTree` gave a
 * `y_sort_enabled` Control's children in scene order. Pure data: no React, no THREE.
 */

import type { Vector2 } from '../../../godot/math/vector';
import { VECTOR2_ZERO } from '../../../godot/math/vector';
import type { ControlOrigins, ControlRuns } from '../../contexts/ControlYSortContext';
import { ysortsChildren, type PaintRange } from '../../canvasPaintOrder';
import { compareSortY } from '../../ySortOrder';
import type { SolvedControl } from './controlRectSolver';
import { controlDrawTransformOf, controlItemOriginUnder } from './controlPixelSnap';
import { controlProps, isPromotedControl, type SolveNode } from './solveTree';

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
 * The origin of a Control's canvas item in its parent, which `_collect_ysort_children` sorts on
 * (`renderer_canvas_cull.cpp:131`).
 */
function controlItemOriginOf(node: SolveNode, solved: SolvedControl, snapToPixels: boolean): Vector2 {
  return controlItemOriginUnder(solved.rect, VECTOR2_ZERO, solvedDrawTransformOf(node, solved), snapToPixels);
}

/**
 * The canvas item origin of each Control that parents at a non-Control: a walk root, or a Control
 * promoted past a Node2D. A y-sorted Node2D sorts those, and `sortYSortedControls` the rest.
 */
export function controlOriginsOf(
  tree: readonly SolveNode[],
  solved: ReadonlyMap<string, SolvedControl>,
  snapToPixels: boolean
): ControlOrigins {
  const origins = new Map<string, Vector2>();
  const visit = (node: SolveNode, isRoot: boolean): void => {
    const entry = solved.get(node.path);
    if (entry && (isRoot || isPromotedControl(node))) {
      origins.set(node.path, controlItemOriginOf(node, entry, snapToPixels));
    }
    for (const child of node.children) visit(child, false);
  };
  for (const root of tree) visit(root, true);
  return origins;
}

/**
 * `node` and its subtree with every draw sequence moved by `delta`. It mirrors each sequence field
 * of `SolveNode`: a new one has to move here too.
 */
function shiftedBy(node: SolveNode, delta: number): SolveNode {
  if (delta === 0) return node;
  const shift = (range: PaintRange): PaintRange => ({ base: range.base + delta, size: range.size });
  return {
    ...node,
    children: node.children.map((child) => shiftedBy(child, delta)),
    paintRange: shift(node.paintRange),
    behindRanges: node.behindRanges.map(shift),
    paintSequence: node.paintSequence + delta,
    backSequence: node.backSequence + delta,
    layerSequence: node.layerSequence + delta,
  };
}

/**
 * `children` re-packed in y order from the lowest base among them. A child the solve did not
 * place, or a promoted one, keeps its run: it is no child item of this node.
 */
function packedByY(
  children: readonly SolveNode[],
  solved: ReadonlyMap<string, SolvedControl>,
  snapToPixels: boolean
): readonly SolveNode[] {
  const sortable = children.filter((child) => !isPromotedControl(child) && solved.has(child.path));
  if (sortable.length < 2) return children;
  const sortYs = new Map(
    sortable.map((child) => [child, controlItemOriginOf(child, solved.get(child.path)!, snapToPixels).y])
  );
  // Array#sort is stable, so equal ys keep the scene order `ysort_index` gives.
  const sorted = [...sortable].sort((a, b) => compareSortY(sortYs.get(a)!, sortYs.get(b)!));
  let base = sortable.reduce((lowest, child) => Math.min(lowest, child.paintRange.base), Infinity);
  const placed = new Map<SolveNode, SolveNode>();
  for (const child of sorted) {
    placed.set(child, shiftedBy(child, base - child.paintRange.base));
    base += child.paintRange.size;
  }
  const repacked = children.map((child) => placed.get(child) ?? child);
  return repacked.every((child, i) => child === children[i]) ? children : repacked;
}

/**
 * `tree` with each subtree whose path has a run moved to the base of that run. A y-sorted Node2D
 * gives its Control children their runs, and a run keeps the size the subtree already has.
 */
export function placeInRuns(tree: readonly SolveNode[], runs: ControlRuns): readonly SolveNode[] {
  if (runs.size === 0) return tree;
  const placed = tree.map((node) => placedBelow(node, runs));
  return placed.every((node, i) => node === tree[i]) ? tree : placed;
}

function placedBelow(node: SolveNode, runs: ControlRuns): SolveNode {
  const run = runs.get(node.path);
  const moved = run ? shiftedBy(node, run.base - node.paintRange.base) : node;
  const children = placeInRuns(moved.children, runs);
  return children === moved.children ? moved : { ...moved, children };
}

/**
 * `tree` with each `y_sort_enabled` Control's children drawn in y order, or `tree` itself when no
 * Control sorts. The sort y is the origin of the child's canvas item, snapped as it draws.
 */
export function sortYSortedControls(
  tree: readonly SolveNode[],
  solved: ReadonlyMap<string, SolvedControl>,
  snapToPixels: boolean
): readonly SolveNode[] {
  const sortedTree = tree.map((node) => sortedBelow(node, solved, snapToPixels));
  return sortedTree.every((node, i) => node === tree[i]) ? tree : sortedTree;
}

function sortedBelow(
  node: SolveNode,
  solved: ReadonlyMap<string, SolvedControl>,
  snapToPixels: boolean
): SolveNode {
  const below = sortYSortedControls(node.children, solved, snapToPixels);
  const ordered = ysortsChildren(node.node) ? packedByY(below, solved, snapToPixels) : below;
  return ordered === node.children ? node : { ...node, children: ordered };
}
