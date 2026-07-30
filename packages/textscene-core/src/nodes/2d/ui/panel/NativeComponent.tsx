/**
 * `<PanelNative>` — the native (WebGL canvas) painter for `Panel`. Draws its
 * `theme_override_styles/panel` StyleBox across the node's ENTIRE solved
 * rect, exactly matching `panel.cpp`'s `NOTIFICATION_DRAW`:
 *
 *     theme_cache.panel_style->draw(ci, Rect2(Point2(), get_size()));
 *
 * Falls back to the default theme's `panel` struct (`nativeTheme.ts`'s
 * `widgets.panel` — NOT re-transcribed here) when no override resolves. Not a
 * container: `Panel` registers no `ContainerLayoutFn`, so its children solve
 * as free/anchored Controls against its own rect and `ControlCanvasWalker`
 * draws them as siblings of this painter, not through it. Visibility
 * (`visible === false`) is the WALKER's job (it hides this node's whole
 * `<group>`), not this painter's — mirroring `ColorRectNative`, this
 * component does not re-check it.
 *
 * `ControlCanvasWalker` already composes this node's OWN `modulate` into the
 * `Modulate2DContext` value it provides around this painter (`tint.inherited`
 * = ancestor tint × this node's `modulate`), so `useParentModulate()` here
 * already carries that product — calling `useControlTint`/`useCanvasItemTint`
 * with this node's `modulate` again would multiply it a SECOND time. What the
 * walker does NOT (and must not) do is apply `self_modulate`, which only ever
 * tints a node's OWN pixels and must never reach `Modulate2DContext` for
 * children to inherit. This painter therefore calls `useCanvasItemTint`
 * directly with `modulate: WHITE_MODULATE` (a no-op — the ambient value
 * already has this node's `modulate` folded in) and `self_modulate` from this
 * node's own properties, exactly like `ColorRectNative`.
 *
 * Unlike `ColorRect` (one `color` property), a StyleBox carries TWO base
 * colours (`bgColor`, `borderColor`) that both need the SAME composed tint —
 * so instead of passing a single `ownMultiplier` to `useCanvasItemTint`, this
 * reads its `own` product (ancestor × own modulate × self_modulate, still raw
 * sRGB) and multiplies it into both colours itself, letting `StyleBoxQuad`
 * supply the one sRGB→linear conversion `useControlTint.ts` requires.
 */
import { PanelChrome } from '../../../../r3f/controls/native/PanelChrome';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function PanelNative({ solveNode, rect, renderOrder }: NativeControlComponentProps) {
  return <PanelChrome solveNode={solveNode} rect={rect} renderOrder={renderOrder} />;
}
