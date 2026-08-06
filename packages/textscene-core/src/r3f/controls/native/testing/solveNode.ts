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

import type { SolveNode } from '../solveTree';

/**
 * Frozen because they are SHARED across every node this factory builds, where a
 * hand-written literal used to get a fresh `{}`/`[]` each time. TypeScript's
 * `readonly` is erased at runtime, so without the freeze an in-place mutation
 * would silently leak into every other node in the run and surface as an
 * unrelated test failing far from the mutation. The freeze makes it throw at the
 * mutation site instead.
 */
const NO_STYLE_BOXES: SolveNode['styleBoxes'] = Object.freeze({});
const NO_FONT_OVERRIDES: SolveNode['fontOverrides'] = Object.freeze({});
const NO_THEME_CHAIN: SolveNode['themeChain'] = Object.freeze([]);

/**
 * Every field but `path`/`node` — the two a real `SolveNode` always needs a
 * caller-specific value for (there is no meaningful default "which node is
 * this"). Spread this into a literal, then supply `path`/`node` explicitly.
 */
export function solveNode(): Pick<
  SolveNode,
  'children' | 'styleBoxes' | 'textureSize' | 'fontOverrides' | 'themeChain' | 'projectTheme'
> {
  return {
    children: [],
    styleBoxes: NO_STYLE_BOXES,
    textureSize: null,
    fontOverrides: NO_FONT_OVERRIDES,
    themeChain: NO_THEME_CHAIN,
    projectTheme: null,
  };
}
