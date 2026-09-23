/**
 * The native (WebGL canvas) painter for `Panel`. It draws the panel StyleBox,
 * or the default theme's `widgets.panel`, across the whole solved rect, as
 * `panel.cpp` does: `theme_cache.panel_style->draw(ci, Rect2(Point2(), get_size()))`.
 */
import { PanelChrome } from '../../../../r3f/controls/native/PanelChrome';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

// Not a container: children solve against this rect and the walker draws them
// as siblings. The walker also owns `visible === false`. `tint.own` is raw
// sRGB, and `<StyleBoxQuad>` multiplies it into both the bg and border colour.
export function Panel({ solveNode, tint, rect, theme, renderOrder }: NativeControlComponentProps) {
  return <PanelChrome solveNode={solveNode} tint={tint} rect={rect} theme={theme} renderOrder={renderOrder} />;
}
