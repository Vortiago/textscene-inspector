/**
 * The painter props a test does not care about, so a new required field is one
 * edit here and never a reason to make it optional. Spread it first:
 *
 *     <Panel {...painterEnv()} solveNode={n} rect={RECT} renderOrder={0} />
 */
// Defaults are what `ControlCanvasWalker` supplies for a childless Control in a
// project with no theme scale, as the `scenes/fixtures/` scenes resolve to.

import { nativeTheme } from '../nativeTheme';
import { WHITE_MODULATE, type RGBA } from '../../../canvasItemModulate';
import { godotColorToLinear } from '../../../godotColor';
import type { NativeControlComponentProps } from '../../ControlComponentRegistry';
import type { ControlOwnTint } from '../controlTint';
import type { Rect2 } from '../rect';

const NO_CHILD_RECTS: ReadonlyMap<string, Rect2> = new Map();

/**
 * A composed own-pixel tint at an sRGB value, as the walker hands a painter.
 * `own` is already `modulate × self_modulate`, so a test states the product.
 */
export function painterTint(own: RGBA = WHITE_MODULATE): ControlOwnTint {
  return { own, color: godotColorToLinear(own), opacity: own.a };
}

/**
 * The environment half of a painter's props: theme, measurer, child rects, the
 * post-subtree chrome draw order and this Control's own `z_final`.
 */
export function painterEnv(): Pick<
  NativeControlComponentProps,
  | 'theme'
  | 'measureText'
  | 'childRects'
  | 'subtreeChromeRenderOrder'
  | 'effectiveZ'
  | 'snapToPixels'
  | 'meta'
  | 'tint'
> {
  return {
    theme: nativeTheme(1),
    measureText: null,
    childRects: NO_CHILD_RECTS,
    // A childless Control at paint index 0. Required on the contract, since an
    // absent value would draw chrome under the subtree.
    subtreeChromeRenderOrder: 0,
    // A Control with no `z_index`. A lit painter passes it to
    // `useCanvasItemLighting`, whose fallback reads the parent's z.
    effectiveZ: 0,
    // The `Viewport::snap_controls_to_pixels` initialiser (`scene/main/viewport.h`).
    snapToPixels: true,
    meta: undefined,
    // Opaque white: the walker's fold is asserted in the walker's tests.
    tint: painterTint(),
  };
}
