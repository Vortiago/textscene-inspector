/**
 * What the one y-sort of a canvas reads off the Control rect solve, keyed by live path: the
 * transform of each Control's canvas item, whose origin it sorts on (`control.cpp:719-736`), and
 * the internal back pieces each y-sorting Control draws. Pure data: no React, no THREE.
 */

import { transform2DFromParts } from '../../../godot/math/transform2d';
import { joinPath } from '../../../utils/nodePath';
import { ysortsChildren } from '../../canvasPaintOrder';
import type { ControlTransforms } from '../../contexts/YSortContext';
import type { ExtraSortItem, ExtraSortItems } from '../../canvasItemPass/ySort';
import type { SolvedControl } from './controlRectSolver';
import { controlDrawTransformOf, controlItemOrigin } from './controlPixelSnap';
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
 * The transform of every Control's canvas item in its parent, by live path below `livePath`:
 * `_update_canvas_item_transform` (`control.cpp:719-737`), whose origin is the position plus the
 * pivot translation, whole pixels when it snaps. A y-sort reads the origin of each item it sorts,
 * and composes the whole transform down a y-sorted item it merges.
 */
export function controlTransformsOf(
  tree: readonly SolveNode[],
  solved: ReadonlyMap<string, SolvedControl>,
  snapToPixels: boolean,
  livePath: string
): ControlTransforms {
  const transforms = new Map<string, ReturnType<typeof transform2DFromParts>>();
  eachSolveNode(tree, (node) => {
    const entry = solved.get(node.path);
    if (!entry) return;
    const draw = solvedDrawTransformOf(node, entry);
    const origin = controlItemOrigin(entry.rect, draw, snapToPixels);
    transforms.set(joinPath(livePath, node.path), transform2DFromParts(draw.rotation, draw.scale, 0, origin));
  });
  return transforms;
}

/**
 * The `INTERNAL_MODE_BACK` children each y-sorting Control draws itself, which its sort collects
 * after its authored children (`renderer_canvas_cull.cpp:110-160`), by the Control's live path
 * below `livePath`. Each id is that live path and the piece's name, joined by {@link backPieceId}.
 */
export function backPiecesOf(
  tree: readonly SolveNode[],
  solved: ReadonlyMap<string, SolvedControl>,
  livePath: string
): ExtraSortItems {
  const pieces = new Map<string, ExtraSortItem[]>();
  eachSolveNode(tree, (node) => {
    const piecesOf = controlSolverRegistry.internalBackPieces(node.node.type);
    const entry = solved.get(node.path);
    if (!piecesOf || !entry || !ysortsChildren(node.node)) return;
    const live = joinPath(livePath, node.path);
    const items = piecesOf(entry).map(({ name, origin }) => ({
      id: backPieceId(live, name),
      origin,
      size: 1,
      followsChildren: true,
    }));
    if (items.length > 0) pieces.set(live, items);
  });
  return pieces;
}

/** The id the sort gives the back piece `name` of the Control at live path `livePath`. */
export function backPieceId(livePath: string, name: string): string {
  return `${livePath}#${name}`;
}

/** Visits every node of the forest in tree order. */
function eachSolveNode(tree: readonly SolveNode[], visit: (node: SolveNode) => void): void {
  const walk = (node: SolveNode): void => {
    visit(node);
    for (const child of node.children) walk(child);
  };
  for (const root of tree) walk(root);
}
