/**
 * The painter props a test does not care about, so widening the contract is one
 * edit rather than one per slice.
 *
 * Spread it FIRST and let a test's own explicit attributes override:
 *
 *     <Panel {...painterEnv()} solveNode={n} rect={RECT} renderOrder={0} />
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
import { WHITE_MODULATE, type RGBA } from '../../../canvasItemModulate';
import { godotColorToLinear } from '../../../godotColor';
import type { NativeControlComponentProps } from '../../ControlComponentRegistry';
import type { ControlOwnTint } from '../controlTint';
import type { Rect2 } from '../rect';

const NO_CHILD_RECTS: ReadonlyMap<string, Rect2> = new Map();

/**
 * A composed own-pixel tint at an arbitrary sRGB value — what the walker hands
 * a painter, without a walk. `own` is already `modulate × self_modulate`, so a
 * test states the PRODUCT rather than the factors that made it.
 */
export function painterTint(own: RGBA = WHITE_MODULATE): ControlOwnTint {
  return { own, color: godotColorToLinear(own), opacity: own.a };
}

/**
 * The environment half of a painter's props — theme, measurer, child rects,
 * the post-subtree chrome draw order, and this Control's own `z_final`.
 *
 * `subtreeChromeRenderOrder` defaults to `0` — the value the walker derives
 * for a childless Control at paint index 0 — because only the painters with
 * `INTERNAL_MODE_BACK`-style chrome read it at all, and one of those asserting
 * draw order overrides it explicitly. It belongs here rather than being made
 * optional on the contract: an absent value there would let a painter silently
 * fall back to its own `renderOrder` and draw its chrome under its own subtree.
 *
 * `effectiveZ` defaults to `0` for the same reason and with the same shape of
 * hazard — Godot's z for a Control authoring no `z_index` under no
 * z-shifting ancestor. A painter that opts into 2D lighting must pass it to
 * `useCanvasItemLighting` explicitly, since that parameter's own fallback
 * reads the ambient context, which is the PARENT's z.
 *
 * `tint` defaults to opaque white — a scene authoring neither `modulate` nor
 * `self_modulate` anywhere above the node. A painter asserting composition
 * passes `painterTint(own)` with the product it wants; the FOLD that produced
 * it is the walker's, and is asserted there.
 *
 * `snapToPixels` defaults to `true`: Godot's own
 * `Viewport::snap_controls_to_pixels` initialiser (`scene/main/viewport.h`),
 * which every viewport keeps unless it is the root window and the project
 * opted out. A painter asserting the OFF case states it.
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
    subtreeChromeRenderOrder: 0,
    effectiveZ: 0,
    snapToPixels: true,
    meta: undefined,
    tint: painterTint(),
  };
}
