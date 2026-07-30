/**
 * The painter props a test does not care about, so widening the contract is one
 * edit rather than one per slice.
 *
 * Spread it FIRST and let a test's own explicit attributes override:
 *
 *     <PanelNative {...painterEnv()} solveNode={n} rect={RECT} renderOrder={0} />
 *
 * Before this existed, every painter test hand-rolled the whole props object, so
 * adding a required field broke sixteen test files at once — which is both
 * tedious and a quiet pressure to make new fields optional purely for test
 * convenience, weakening the contract the real caller depends on.
 *
 * Defaults mirror what `ControlCanvasWalker` supplies for a Control with no
 * children in a project that sets no theme scale, which is what the fixtures
 * under `scenes/fixtures/` resolve to.
 */

import { nativeTheme } from '../nativeTheme';
import type { NativeControlComponentProps } from '../../ControlComponentRegistry';
import type { Rect2 } from '../rect';

const NO_CHILD_RECTS: ReadonlyMap<string, Rect2> = new Map();

/** The environment half of a painter's props — theme, measurer, child rects. */
export function painterEnv(): Pick<
  NativeControlComponentProps,
  'theme' | 'measureText' | 'childRects'
> {
  return { theme: nativeTheme(1), measureText: null, childRects: NO_CHILD_RECTS };
}
