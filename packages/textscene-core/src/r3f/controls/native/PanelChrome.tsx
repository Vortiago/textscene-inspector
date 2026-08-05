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
 * Note what is deliberately NOT applied: this node's own `modulate`. The walker
 * has already folded it into the ambient modulate context, so re-applying it
 * would square it. Only `self_modulate` — which tints a node's own pixels and
 * must never reach children — is applied here.
 */

import { useCanvasItemTint, WHITE_MODULATE, type RGBA } from '../../canvasItemModulate';
import { StyleBoxQuad } from './StyleBoxQuad';
import type { NativeTheme } from './nativeTheme';
import type { SolveNode } from './solveTree';
import type { Rect2 } from './rect';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';

export interface PanelChromeProps {
  solveNode: SolveNode;
  rect: Rect2;
  /** The walker's own theme — passed down rather than re-derived, so this chrome and the solve that sized it can never read different metrics. */
  theme: NativeTheme;
  renderOrder: number;
}

export function PanelChrome({ solveNode, rect, theme, renderOrder }: PanelChromeProps) {
  const props = solveNode.node.properties as ControlProperties;
  const baseStyleBox = solveNode.styleBoxes.panel ?? theme.widgets.panel;

  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });

  return <StyleBoxQuad styleBox={baseStyleBox} color={tint.own} rect={rect} renderOrder={renderOrder} />;
}

