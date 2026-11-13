/**
 * The native (WebGL canvas) painter for `PanelContainer`. `panel_container.cpp`
 * draws the same chrome as `<Panel>`: the table's `Panel/panel` and `PanelContainer/panel`
 * are the same `make_flat_stylebox(style_normal_color, 0, 0, 0, 0)`.
 */
import { PanelChrome } from '../../../../r3f/controls/native/PanelChrome';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

// Chrome only. `nativeSolver.ts` owns the inset and the minimum size. The
// walker draws the children as siblings, applies the pivot transform and
// owns `visible === false`.
export function PanelContainer({ solveNode, tint, rect, renderOrder }: NativeControlComponentProps) {
  return <PanelChrome solveNode={solveNode} tint={tint} rect={rect} renderOrder={renderOrder} />;
}
