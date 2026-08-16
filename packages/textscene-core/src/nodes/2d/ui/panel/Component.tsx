/**
 * `<Panel>` — the native (WebGL canvas) painter for `Panel`. Draws its
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
 * `<group>`), not this painter's — mirroring `ColorRect`, this
 * component does not re-check it.
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`.
 * Unlike `ColorRect` (one `color` property), a StyleBox carries TWO base
 * colours (`bgColor`, `borderColor`) needing the SAME composed tint — so
 * `PanelChrome` (this painter's actual implementation) hands `tint.own` (raw
 * sRGB) to `<StyleBoxQuad>`'s `color` prop, which multiplies it into both
 * internally before its one sRGB→linear conversion.
 */
import { PanelChrome } from '../../../../r3f/controls/native/PanelChrome';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function Panel({ solveNode, tint, rect, theme, renderOrder }: NativeControlComponentProps) {
  return <PanelChrome solveNode={solveNode} tint={tint} rect={rect} theme={theme} renderOrder={renderOrder} />;
}
