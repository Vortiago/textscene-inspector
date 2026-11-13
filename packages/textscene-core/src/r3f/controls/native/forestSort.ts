/**
 * What a y-sort needs from the Control walk and gives back to it. A Control sorts on the origin of
 * its canvas item (`control.cpp:719-736`), which only the rect solve knows, so
 * {@link controlTransformsOf} reads it off the solve, and {@link forestInCanvasSort} moves the paint
 * `buildSolveTree` gave in tree order to the runs the sort gave.
 * Pure data: no React, no THREE.
 */

import { VECTOR2_ZERO } from '../../../godot/math/vector';
import { transform2DFromParts } from '../../../godot/math/transform2d';
import { joinPath } from '../../../utils/nodePath';
import { ysortsChildren, type PaintRange } from '../../canvasPaintOrder';
import type { ControlTransforms, SortedRunsValue } from '../../contexts/YSortContext';
import type { CanvasItemPaint } from '../../canvasItemPass/canvasItemPaint';
import { sortedPaintOf, type ExtraSortItem, type ExtraSortItems } from '../../canvasItemPass/ySort';
import type { SolvedControl } from './controlRectSolver';
import { controlDrawTransformOf, controlItemOriginUnder } from './controlPixelSnap';
import { controlProps, type SolveNode } from './solveTree';
import { controlSolverRegistry } from './solverRegistry';

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
  eachSolveNode(tree, (node) => {
    const entry = solved.get(node.path);
    if (!entry) return;
    const draw = solvedDrawTransformOf(node, entry);
    const origin = controlItemOriginUnder(entry.rect, VECTOR2_ZERO, draw, snapToPixels);
    transforms.set(node.path, transform2DFromParts(draw.rotation, draw.scale, 0, origin));
  });
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
 * The `INTERNAL_MODE_BACK` children each y-sorting Control draws itself, which its sort collects
 * after its authored children (`renderer_canvas_cull.cpp:110-160`). Each id is the Control's path
 * and the piece's name, joined by {@link pieceIdOf}.
 */
export function forestBackPiecesOf(
  tree: readonly SolveNode[],
  solved: ReadonlyMap<string, SolvedControl>
): ExtraSortItems {
  const pieces = new Map<string, ExtraSortItem[]>();
  eachSolveNode(tree, (node) => {
    const piecesOf = controlSolverRegistry.internalBackPieces(node.node.type);
    const entry = solved.get(node.path);
    if (!piecesOf || !entry || !ysortsChildren(node.node)) return;
    const items = piecesOf(entry).map(({ name, origin }) => ({
      id: pieceIdOf(node.path, name),
      origin,
      size: 1,
      followsChildren: true,
    }));
    if (items.length > 0) pieces.set(node.path, items);
  });
  return pieces;
}

/** The id a sort gives the piece `name` of the Control at `path`. */
function pieceIdOf(path: string, name: string): string {
  return `${path}#${name}`;
}

/** `pieces` keyed and named by live path, as `transformsAtLivePaths` keys transforms. */
export function piecesAtLivePaths(livePath: string, pieces: ExtraSortItems): ExtraSortItems {
  if (livePath === '') return pieces;
  return new Map(
    [...pieces].map(([path, items]) => [
      joinPath(livePath, path),
      items.map((item) => ({ ...item, id: joinPath(livePath, item.id) })),
    ])
  );
}

/** How the walk draws a forest after the y-sort of its canvas, by the forest's own paths. */
export interface ForestSort {
  /** Each Control's paint as the walk draws it. */
  readonly paints: ReadonlyMap<string, CanvasItemPaint>;
  /** The run of each internal back piece the sort placed, by the Control's path, then the piece's name. */
  readonly pieceRuns: ReadonlyMap<string, ReadonlyMap<string, PaintRange>>;
  /** The Controls that hand their children the clip they took (`mergedSorters`). */
  readonly mergedSorters: ReadonlySet<string>;
}

/** The forest drawn at the runs of the one sort of its canvas, which the shared live tree gives by live path. */
export function forestInCanvasSort(
  tree: readonly SolveNode[],
  livePath: string,
  canvas: SortedRunsValue,
  pieces: ExtraSortItems
): ForestSort {
  const drawn = new Map<string, CanvasItemPaint>();
  const merged = new Set<string>();
  // By live path, so a Control inside the run of a Node2D entry the sort moved moves with it.
  for (const [path, paint] of forestPaintsOf(tree)) {
    const live = joinPath(livePath, path);
    drawn.set(path, sortedPaintOf(live, canvas.paints.get(live) ?? paint, canvas.runs, canvas.paints));
    if (canvas.mergedSorters.has(live)) merged.add(path);
  }
  return {
    paints: drawn,
    pieceRuns: pieceRunsOf(pieces, (id) => canvas.runs.get(joinPath(livePath, id))),
    mergedSorters: merged,
  };
}

function pieceRunsOf(
  pieces: ExtraSortItems,
  runOf: (id: string) => PaintRange | undefined
): ReadonlyMap<string, ReadonlyMap<string, PaintRange>> {
  const runs = new Map<string, Map<string, PaintRange>>();
  for (const [path, items] of pieces) {
    const named = new Map<string, PaintRange>();
    for (const { id } of items) {
      const run = runOf(id);
      if (run) named.set(id.slice(pieceIdOf(path, '').length), run);
    }
    if (named.size > 0) runs.set(path, named);
  }
  return runs;
}

/** Whether the shared live tree holds the forest's nodes, so the canvas's one sort covers them. */
export function isInSharedTree(
  tree: readonly SolveNode[],
  livePath: string,
  paints: ReadonlyMap<string, CanvasItemPaint>
): boolean {
  const root = tree[0];
  return root !== undefined && paints.has(joinPath(livePath, root.path));
}

/** The tree-order paint of every node of the forest, by its path. */
function forestPaintsOf(tree: readonly SolveNode[]): ReadonlyMap<string, CanvasItemPaint> {
  const paints = new Map<string, CanvasItemPaint>();
  eachSolveNode(tree, (node) => paints.set(node.path, node.paint));
  return paints;
}

/** Visits every node of the forest in tree order, with the node above it, null for a root. */
function eachSolveNode(
  tree: readonly SolveNode[],
  visit: (node: SolveNode, parent: SolveNode | null) => void
): void {
  const walk = (node: SolveNode, parent: SolveNode | null): void => {
    visit(node, parent);
    for (const child of node.children) walk(child, node);
  };
  for (const root of tree) walk(root, null);
}
