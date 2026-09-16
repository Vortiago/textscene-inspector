/**
 * The `SolveNode` fields a test does not care about, so widening the contract
 * (`fontOverrides`/`themeChain`/`projectTheme` going from optional to
 * required — see `solveTree.ts`'s own doc for why) is one edit rather than
 * one per test literal.
 *
 * Spread it FIRST and let a test's own explicit fields override, mirroring
 * `painterProps.ts`'s `painterEnv()`:
 *
 *     const n: SolveNode = { ...solveNode(), path: 'L', node: labelNode };
 *
 * Before `painterEnv()` existed, a required painter-prop field addition broke
 * every test file that hand-rolled the whole props object at once — which is
 * both tedious and a quiet pressure toward making new fields optional purely
 * for test convenience. The same pressure applies to `SolveNode`: a solver
 * reading `n.themeChain ?? []` resolves no theme in every hand-built literal
 * that omits it, so a test can pass while production (which always populates
 * these three fields, `buildSolveTree.ts`) takes a different path. Requiring
 * the fields on the type, with this factory to keep literals short, makes
 * that omission a compile error instead of a silent divergence.
 *
 * `children`/`styleBoxes`/`textureSize` were already required before this
 * factory existed — included here anyway so a literal that wants every
 * omittable field defaulted can spread this alone rather than mixing a spread
 * with a partial explicit object.
 */

import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../solveTree';
import {
  allocatePaintRange,
  WHOLE_CANVAS_RANGE,
  type PaintRange,
} from '../../../canvasPaintOrder';

/**
 * Frozen because they are SHARED across every node this factory builds, where a
 * hand-written literal used to get a fresh `{}`/`[]` each time. TypeScript's
 * `readonly` is erased at runtime, so without the freeze an in-place mutation
 * would silently leak into every other node in the run and surface as an
 * unrelated test failing far from the mutation. The freeze makes it throw at the
 * mutation site instead.
 */
const NO_STYLE_BOXES: SolveNode['styleBoxes'] = Object.freeze({});
const NO_TEXTURE_SLOTS: SolveNode['textureSlots'] = Object.freeze({});
const NO_FONT_OVERRIDES: SolveNode['fontOverrides'] = Object.freeze({});
const NO_THEME_CHAIN: SolveNode['themeChain'] = Object.freeze([]);
const NO_COLORS: SolveNode['colors'] = Object.freeze({});
const NO_CONSTANTS: SolveNode['constants'] = Object.freeze({});
const NO_RESOURCES: SolveNode['resources'] = Object.freeze({
  externalResources: Object.freeze([]),
  internalResources: Object.freeze([]),
});

/**
 * Every field but `path`/`node` — the two a real `SolveNode` always needs a
 * caller-specific value for (there is no meaningful default "which node is
 * this"). Spread this into a literal, then supply `path`/`node` explicitly.
 */
export function solveNode(): Pick<
  SolveNode,
  | 'children'
  | 'styleBoxes'
  | 'textureSize'
  | 'textureSlots'
  | 'hidden'
  | 'fontOverrides'
  | 'themeChain'
  | 'projectTheme'
  | 'colors'
  | 'constants'
  | 'resources'
  | 'paintRange'
  | 'paintSequence'
> {
  return {
    children: [],
    styleBoxes: NO_STYLE_BOXES,
    textureSize: null,
    textureSlots: NO_TEXTURE_SLOTS,
    hidden: false,
    fontOverrides: NO_FONT_OVERRIDES,
    themeChain: NO_THEME_CHAIN,
    projectTheme: null,
    colors: NO_COLORS,
    constants: NO_CONSTANTS,
    resources: NO_RESOURCES,
    // The whole canvas, which is what a lone Control owns. A test asserting
    // draw order between several of them wants `withPaintRanges` instead —
    // these defaults deliberately TIE, rather than inventing an order a
    // hand-built tree never stated.
    paintRange: WHOLE_CANVAS_RANGE,
    paintSequence: WHOLE_CANVAS_RANGE.base,
  };
}

/**
 * Assign each node in a hand-built `SolveNode` tree the draw-sequence run it
 * would get from `buildSolveTree`, so a test can assert paint ORDER.
 *
 * Production allocates over a node's LIVE children — every sibling, Control or
 * not — because that is the order Godot's walk visits. A hand-built tree has
 * only its Controls, so this allocates over those: the same pre-order rule
 * applied to the only siblings such a tree declares.
 */
export function withPaintRanges(
  roots: readonly SolveNode[],
  range: PaintRange = WHOLE_CANVAS_RANGE
): SolveNode[] {
  // Delegated to the production allocator, exactly as `buildSolveTree` and
  // `NodeDispatcher` do for the root list — a hand-rolled cursor here started
  // roots one value LOWER than production does, so every test built on it was
  // green against sequences the renderer never emits.
  const allocated = allocatePaintRange(range, roots.map(shadowTree));
  return roots.map((root, i) => assignRange(root, allocated.children[i]!));
}

/**
 * A hand-built `SolveNode` carries its children on ITSELF and leaves
 * `node.children` empty, so the production allocator — which reads the node
 * tree — would size every subtree at 1 and overlap the siblings. This rebuilds
 * the `TscnNode` tree the allocator expects.
 */
function shadowTree(n: SolveNode): TscnNode {
  return { ...n.node, children: n.children.map(shadowTree) };
}

/** Split `own` between a node and its children through the PRODUCTION allocator. */
function assignRange(node: SolveNode, own: PaintRange): SolveNode {
  const allocated = allocatePaintRange(own, node.children.map(shadowTree));
  return {
    ...node,
    paintRange: own,
    paintSequence: allocated.self,
    children: node.children.map((child, i) => assignRange(child, allocated.children[i]!)),
  };
}
