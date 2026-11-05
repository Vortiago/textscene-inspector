/**
 * The painter props a test does not care about, so a new required field is one
 * edit here and never a reason to make it optional. Spread it first:
 *
 *     <Panel {...painterEnv()} solveNode={n} rect={RECT} renderOrder={0} />
 */
// Defaults are what `ControlCanvasWalker` supplies for a childless Control in a
// project with no theme scale, as the `scenes/fixtures/` scenes resolve to.

import { nativeTheme } from '../nativeTheme';
import { WHITE_MODULATE, type OwnPixelTint } from '../../../canvasItemModulate';
import { godotColorToLinear } from '../../../godotColor';
import type { NativeControlComponentProps } from '../../ControlComponentRegistry';
import { wholeKeySlot } from '../../../canvasItemState';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { Rgba } from '../../../../godot/math/math';

const NO_CHILD_RECTS: ReadonlyMap<string, Rect2> = new Map();

/**
 * A composed own-pixel tint at an sRGB value, as the walker hands a painter.
 * `own` is already `modulate × self_modulate`, so a test states the product.
 */
export function painterTint(own: Rgba = WHITE_MODULATE): OwnPixelTint {
  return { own, color: godotColorToLinear(own), opacity: own.a };
}

/**
 * The environment half of a painter's props: theme, measurer, child rects, the
 * post-subtree chrome draw order and the snap.
 */
export function painterEnv(): Pick<
  NativeControlComponentProps,
  | 'theme'
  | 'measureText'
  | 'childRects'
  | 'slot'
  | 'chromeSlot'
  | 'layerSlot'
  | 'snapToPixels'
  | 'meta'
  | 'tint'
> {
  return {
    theme: nativeTheme(1),
    measureText: null,
    childRects: NO_CHILD_RECTS,
    // Key 0's slot, for a test that keeps `renderOrder` at 0. A test of a painter's pieces passes
    // the slot of its own `renderOrder`.
    slot: wholeKeySlot(0),
    // A back slot at key 0. Required on the contract, since an absent value
    // would draw chrome under the subtree.
    chromeSlot: wholeKeySlot(0),
    layerSlot: wholeKeySlot(0),
    // The `Viewport::snap_controls_to_pixels` initialiser (`scene/main/viewport.h`).
    snapToPixels: true,
    meta: undefined,
    // Opaque white: the walker's fold is asserted in the walker's tests.
    tint: painterTint(),
  };
}
