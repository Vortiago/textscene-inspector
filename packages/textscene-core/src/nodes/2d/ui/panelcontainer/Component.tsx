/**
 * `<PanelContainer>` — the native (WebGL canvas) painter for
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
 * Tint composition mirrors `<Panel>` exactly — `self_modulate` onto BOTH of
 * the StyleBox's base colours.
 */
import { PanelChrome } from '../../../../r3f/controls/native/PanelChrome';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';

export function PanelContainer({ solveNode, rect, theme, renderOrder }: NativeControlComponentProps) {
  return <PanelChrome solveNode={solveNode} rect={rect} theme={theme} renderOrder={renderOrder} />;
}
