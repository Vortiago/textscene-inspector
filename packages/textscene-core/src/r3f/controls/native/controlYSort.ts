/**
 * What a y-sort needs from the Control walk and gives back to it. A Control sorts on the origin of
 * its canvas item (`control.cpp:719-736`), which only the rect solve knows, so
 * {@link controlTransformsOf} reads it off the solve, and {@link applyYSortShifts} moves the
 * draw-sequence runs `buildSolveTree` gave in scene order to where the sort put them.
 * Pure data: no React, no THREE.
 */

import { VECTOR2_ZERO } from '../../../godot/math/vector';
import { transform2DFromParts } from '../../../godot/math/transform2d';
import { joinPath, parentPathOf, relativeTo } from '../../../utils/nodePath';
import type { PaintRange } from '../../canvasPaintOrder';
import type { ControlTransforms, YSortShift, YSortShifts } from '../../contexts/ControlYSortContext';
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

/** The shifts the world sort gave the nodes below `livePath`, keyed by the forest's own paths. */
export function shiftsOfForest(livePath: string, shifts: YSortShifts): YSortShifts {
  if (livePath === '') return shifts;
  const own = new Map<string, YSortShift>();
  for (const [path, shift] of shifts) {
    const relative = relativeTo(livePath, path);
    if (relative) own.set(relative, shift);
  }
  return own;
}

/**
 * `node` over `children`, with every draw sequence of its own moved by `delta`. It mirrors each
 * sequence field of `SolveNode`, which `controlYSort.conformance.test.ts` guards.
 */
function withShiftedRuns(node: SolveNode, delta: number, children: readonly SolveNode[]): SolveNode {
  const shift = (range: PaintRange): PaintRange => ({ base: range.base + delta, size: range.size });
  return {
    ...node,
    children,
    paintRange: shift(node.paintRange),
    behindRanges: node.behindRanges.map(shift),
    paintSequence: node.paintSequence + delta,
    backSequence: node.backSequence + delta,
    layerSequence: node.layerSequence + delta,
  };
}

/** The shift of the nearest node above `path` that the sort moved, or undefined. */
function shiftAbove(path: string, shifts: YSortShifts) {
  for (let up = parentPathOf(path); up !== null; up = parentPathOf(up)) {
    const shift = shifts.get(up);
    if (shift) return shift;
  }
  return undefined;
}

/**
 * `tree` with each subtree the y-sort moved drawn at its new run, or `tree` itself when it moved
 * none. A Control the sort lists as an item takes the run it gave. A Control that parents at a
 * non-Control, a walk root or one promoted past a Node2D, moves with the nearest Node2D above it the
 * sort moved, since that item's run holds the Control's.
 */
export function applyYSortShifts(tree: readonly SolveNode[], shifts: YSortShifts): readonly SolveNode[] {
  if (shifts.size === 0) return tree;
  return placeAll(tree, shifts, true, 0);
}

/** `nodes` placed, each by the shift of the nearest ancestor that moved, `inherited` unless it moved itself. */
function placeAll(
  nodes: readonly SolveNode[],
  shifts: YSortShifts,
  areRoots: boolean,
  inherited: number
): readonly SolveNode[] {
  const placed = nodes.map((node) => placeNode(node, shifts, areRoots, inherited));
  return placed.every((node, i) => node === nodes[i]) ? nodes : placed;
}

function placeNode(node: SolveNode, shifts: YSortShifts, isRoot: boolean, inherited: number): SolveNode {
  const own = shifts.get(node.path);
  const above = !own && (isRoot || isPromotedControl(node)) ? shiftAbove(node.path, shifts) : undefined;
  const delta = own ? own.run.base - node.paintRange.base : above ? above.run.base - above.from : inherited;
  return placeChildren(node, shifts, delta);
}

/** `node` moved by `delta`, its children placed under that delta. */
function placeChildren(node: SolveNode, shifts: YSortShifts, delta: number): SolveNode {
  const children = placeAll(node.children, shifts, false, delta);
  return delta === 0 && children === node.children ? node : withShiftedRuns(node, delta, children);
}
