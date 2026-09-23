/**
 * The panel StyleBox that `Panel` and `PanelContainer` both draw across their rect
 * (`panel.cpp`, `panel_container.cpp`). It hands `<StyleBoxQuad>` the untinted
 * StyleBox and `tint.own`: that component multiplies both base colours in raw sRGB,
 * before `styleBoxFlatGeometry` converts to linear.
 */

import { StyleBoxQuad } from './StyleBoxQuad';
import type { NativeControlComponentProps } from '../ControlComponentRegistry';
import type { NativeTheme } from './nativeTheme';
import type { SolveNode } from './solveTree';
import type { Rect2 } from './rect';

export interface PanelChromeProps {
  solveNode: SolveNode;
  rect: Rect2;
  /** The walker's theme, passed down so this chrome and the solve that sized it read the same metrics. */
  theme: NativeTheme;
  /** The painter's own-pixel tint, with `self_modulate` folded in: this chrome is not a Control of its own. */
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
}

export function PanelChrome({ solveNode, rect, theme, tint, renderOrder }: PanelChromeProps) {
  const baseStyleBox = solveNode.styleBoxes.panel ?? theme.widgets.panel;

  return <StyleBoxQuad styleBox={baseStyleBox} color={tint.own} rect={rect} renderOrder={renderOrder} />;
}

