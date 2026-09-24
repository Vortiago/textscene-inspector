/**
 * The native (WebGL canvas) painter for `PanelContainer`. `panel_container.cpp`
 * draws the same chrome as `<Panel>`: `default_theme.cpp:134` and `:1274` build
 * the same fallback with `make_flat_stylebox(style_normal_color, 0, 0, 0, 0)`.
 */
import { PanelChrome } from '../../../../r3f/controls/native/PanelChrome';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

// Chrome only. `nativeSolver.ts` owns the inset and the minimum size. The
// walker draws the children as siblings, applies the pivot transform and
// owns `visible === false`.
export function PanelContainer({ solveNode, tint, rect, theme, renderOrder }: NativeControlComponentProps) {
  return <PanelChrome solveNode={solveNode} tint={tint} rect={rect} theme={theme} renderOrder={renderOrder} />;
}
