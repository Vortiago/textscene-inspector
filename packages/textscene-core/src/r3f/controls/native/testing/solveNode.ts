/**
 * The `SolveNode` fields a test does not care about, so a required field is one
 * edit here and a literal that omits it fails to compile. Spread it first:
 *
 *     const n: SolveNode = { ...solveNode(), path: 'L', node: labelNode };
 */

import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../solveTree';
import {
  allocatePaintRange,
  WHOLE_CANVAS_RANGE,
  type PaintRange,
} from '../../../canvasPaintOrder';

/**
 * Frozen because every node this factory builds shares them, and `readonly` is
 * erased at runtime: a mutation throws where it happens instead of leaking into
 * every other node in the run.
 */
const NO_STYLE_BOXES: SolveNode['styleBoxes'] = Object.freeze({});
const NO_TEXTURE_SLOTS: SolveNode['textureSlots'] = Object.freeze({});
const NO_FONT_OVERRIDES: SolveNode['fontOverrides'] = Object.freeze({});
const NO_THEME_CHAIN: SolveNode['themeChain'] = Object.freeze([]);
const NO_COLORS: SolveNode['colors'] = Object.freeze({});
const NO_CONSTANTS: SolveNode['constants'] = Object.freeze({});
const NO_ICONS: SolveNode['icons'] = Object.freeze({});
const NO_RESOURCES: SolveNode['resources'] = Object.freeze({
  externalResources: Object.freeze([]),
  internalResources: Object.freeze([]),
});

/**
 * Every field but `path` and `node`, which have no meaningful default. Spread
 * this into a literal, then supply both.
 */
export function solveNode(): Pick<
  SolveNode,
  | 'children'
  | 'styleBoxes'
  | 'textureSize'
  | 'textureSlots'
  | 'hidden'
  | 'parentVisibleInTree'
  | 'fontOverrides'
  | 'themeChain'
  | 'projectTheme'
  | 'colors'
  | 'constants'
  | 'icons'
  | 'resources'
  | 'paintRange'
  | 'paintSequence'
  | 'skippedAncestors'
  | 'rtl'
> {
  return {
    children: [],
    styleBoxes: NO_STYLE_BOXES,
    textureSize: null,
    textureSlots: NO_TEXTURE_SLOTS,
    hidden: false,
    // Nothing above hides it: `CanvasItem::parent_visible_in_tree` for a scene
    // root, and what every visible ancestor passes down.
    parentVisibleInTree: true,
    fontOverrides: NO_FONT_OVERRIDES,
    themeChain: NO_THEME_CHAIN,
    projectTheme: null,
    colors: NO_COLORS,
    constants: NO_CONSTANTS,
    icons: NO_ICONS,
    resources: NO_RESOURCES,
    // The whole canvas, which a lone Control owns. These defaults tie rather than
    // invent an order. A test asserting draw order uses `withPaintRanges`.
    paintRange: WHOLE_CANVAS_RANGE,
    paintSequence: WHOLE_CANVAS_RANGE.base,
    // No skipped Node2D ancestor, the common case a hand-built tree states.
    skippedAncestors: null,
    // `LAYOUT_DIRECTION_INHERITED` all the way to a left-to-right root.
    rtl: false,
  };
}

/**
 * Assigns each node in a hand-built `SolveNode` tree the draw-sequence run
 * `buildSolveTree` would, so a test can assert paint order. Production allocates
 * over every live sibling. A hand-built tree has only its Controls.
 */
export function withPaintRanges(
  roots: readonly SolveNode[],
  range: PaintRange = WHOLE_CANVAS_RANGE
): SolveNode[] {
  // The production allocator, as `buildSolveTree` and `NodeDispatcher` use for the
  // root list, so tests see the sequences the renderer emits.
  const allocated = allocatePaintRange(range, roots.map(shadowTree));
  return roots.map((root, i) => assignRange(root, allocated.children[i]!));
}

/**
 * A hand-built `SolveNode` carries its children on itself and leaves
 * `node.children` empty, so the allocator would size every subtree at 1. This
 * rebuilds the `TscnNode` tree the allocator reads.
 */
function shadowTree(n: SolveNode): TscnNode {
  return { ...n.node, children: n.children.map(shadowTree) };
}

/** Splits `own` between a node and its children through the production allocator. */
function assignRange(node: SolveNode, own: PaintRange): SolveNode {
  const allocated = allocatePaintRange(own, node.children.map(shadowTree));
  return {
    ...node,
    paintRange: own,
    paintSequence: allocated.self,
    children: node.children.map((child, i) => assignRange(child, allocated.children[i]!)),
  };
}
