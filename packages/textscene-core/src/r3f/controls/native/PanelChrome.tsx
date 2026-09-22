/**
 * The panel StyleBox, resolved, tinted and drawn — shared because Godot itself
 * shares it: `Panel` and `PanelContainer` both draw `theme_cache.panel_style`
 * across their whole rect (`panel.cpp`, `panel_container.cpp`), and differ only
 * in whether a child is laid out inside it, which lives in each one's own
 * solver rather than here.
 *
 * The tint composition is why this is shared code rather than two copies. A
 * StyleBox carries TWO base colours, so it cannot take the single
 * `ownMultiplier` shortcut a one-colour widget uses: the tint must be
 * multiplied into `bgColor` and `borderColor` while both are still raw sRGB,
 * because `styleBoxFlatGeometry` performs the single sRGB→linear conversion
 * downstream. `<StyleBoxQuad>`'s own `color` prop now does that multiply
 * internally, so this chrome only has to hand it the UNTINTED base StyleBox
 * plus `tint.own` — the ordering is `<StyleBoxQuad>`'s contract to keep, not
 * every consumer's to re-derive.
 *
 * Tint: the painter's own `tint` prop, threaded through unchanged —
 * `self_modulate` already folded onto the inherited `modulate` by the walker.
 */

import { StyleBoxQuad } from './StyleBoxQuad';
import type { NativeControlComponentProps } from '../ControlComponentRegistry';
import type { NativeTheme } from './nativeTheme';
import type { SolveNode } from './solveTree';
import type { Rect2 } from './rect';

export interface PanelChromeProps {
  solveNode: SolveNode;
  rect: Rect2;
  /** The walker's own theme — passed down rather than re-derived, so this chrome and the solve that sized it can never read different metrics. */
  theme: NativeTheme;
  /** The painter's own-pixel tint, unchanged — this chrome is not a Control of its own. */
  tint: NativeControlComponentProps['tint'];
  renderOrder: number;
}

export function PanelChrome({ solveNode, rect, theme, tint, renderOrder }: PanelChromeProps) {
  const baseStyleBox = solveNode.styleBoxes.panel ?? theme.widgets.panel;

  return <StyleBoxQuad styleBox={baseStyleBox} color={tint.own} rect={rect} renderOrder={renderOrder} />;
}

