/**
 * `<PanelContainerNative>` — the native (WebGL canvas) painter for
 * `PanelContainer`. Draws its `theme_override_styles/panel` StyleBox across
 * the node's ENTIRE solved rect (`panel_container.cpp`'s
 * `NOTIFICATION_DRAW`: `theme_cache.panel_style->draw(ci, Rect2(Point2(),
 * get_size()))` — the SAME call `Panel` makes, and the SAME default-theme
 * `panel` struct fallback: `default_theme.cpp:134` and `:1274` both call
 * `make_flat_stylebox(style_normal_color, 0, 0, 0, 0)`, identically).
 *
 * The container BEHAVIOUR — inset content rect, aggregated minimum size —
 * lives in `nativeSolver.ts`, registered through `controlSolverRegistry`; a
 * container's children are the WALKER's siblings of this painter (never this
 * component's own React children), and the free-Control rotate/scale-about-
 * pivot transform is likewise the walker's job, gated on that same registry —
 * this painter draws chrome only.
 *
 * Visibility (`visible === false`) is also the walker's job (it hides this
 * node's whole `<group>`); this painter does not re-check it.
 *
 * Tint composition mirrors `<PanelNative>` exactly — see that module's doc
 * for why `self_modulate` (not `modulate`, already folded into the ambient
 * `Modulate2DContext` by the walker) is the one thing this painter applies,
 * to BOTH of the StyleBox's base colours.
 */
import { useMemo } from 'react';
import { useProjectSettings } from '../../../../r3f/contexts/ProjectSettingsContext';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useCanvasItemTint, WHITE_MODULATE, multiplyModulate, type RGBA } from '../../../../r3f/canvasItemModulate';
import type { ControlProperties } from '../control/types';

/** Multiplies a StyleBox's two base colours by the same composed tint (still raw sRGB). */
function tintedStyleBox(styleBox: StyleBoxFlatData, tint: RGBA): StyleBoxFlatData {
  if (tint.r === 1 && tint.g === 1 && tint.b === 1 && tint.a === 1) return styleBox;
  return {
    ...styleBox,
    bgColor: multiplyModulate(styleBox.bgColor, tint),
    borderColor: multiplyModulate(styleBox.borderColor, tint),
  };
}

export function PanelContainerNative({ solveNode, rect }: NativeControlComponentProps) {
  const props = solveNode.node.properties as ControlProperties;
  const { themeScale } = useProjectSettings();
  const theme = useMemo(() => nativeTheme(themeScale), [themeScale]);
  const baseStyleBox = solveNode.styleBoxes.panel ?? theme.widgets.panel;

  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });
  const styleBox = useMemo(() => tintedStyleBox(baseStyleBox, tint.own), [baseStyleBox, tint.own]);

  return <StyleBoxQuad styleBox={styleBox} rect={rect} />;
}
