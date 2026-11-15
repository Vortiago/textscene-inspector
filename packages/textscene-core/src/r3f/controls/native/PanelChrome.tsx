/**
 * The panel StyleBox that `Panel` and `PanelContainer` both draw across their rect
 * (`panel.cpp`, `panel_container.cpp`). It hands `<StyleBoxQuad>` the untinted
 * StyleBox and `tint.own`: that component multiplies both base colours in raw sRGB,
 * before `styleBoxFlatGeometry` converts to linear.
 */

import { StyleBoxQuad } from './StyleBoxQuad';
import { requiredThemeItem } from './themeItems';
import type { NativeControlComponentProps } from '../ControlComponentRegistry';
import type { SolveNode } from './solveTree';
import type { Rect2 } from '../../../godot/math/rect2';

interface PanelChromeProps {
  solveNode: SolveNode;
  rect: Rect2;
  /** The painter's own-pixel tint, with `self_modulate` folded in: this chrome is not a Control of its own. */
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
}

export function PanelChrome({ solveNode, rect, tint, renderOrder }: PanelChromeProps) {
  const panel = requiredThemeItem(solveNode.styleBoxes, 'panel');

  return <StyleBoxQuad styleBox={panel} color={tint.own} rect={rect} renderOrder={renderOrder} />;
}
