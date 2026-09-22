/**
 * SpinBox's own vendored default-theme icons — `scene/theme/icons/value_up.svg`/
 * `value_down.svg` (Godot 4.6.3, MIT), the `"up"`/`"down"` theme icons
 * (`default_theme.cpp:616-619,620-623`). `native/themeIcons.ts` is out of
 * bounds for this slice to extend (it belongs to the orchestrator), and its
 * `svgDataUrl` helper is not exported, so both are kept local here —
 * `checkbox`'s `CHECK_BOX_ICONS` is the pattern this follows.
 *
 * Licence: Godot Engine, MIT — see THIRD-PARTY-NOTICES.md.
 */

function svgDataUrl(base64: string): string {
  return `data:image/svg+xml;base64,${base64}`;
}

/** `scene/theme/icons/value_up.svg` (16x8). */
const VALUE_UP_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSI4Ij48cGF0aCBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTQgNiA0LTMuNUwxMiA2Ii8+PC9zdmc+Cg==';

/** `scene/theme/icons/value_down.svg` (16x8). */
const VALUE_DOWN_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSI4Ij48cGF0aCBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTEyIDItNCAzLjVMNCAyIi8+PC9zdmc+Cg==';

/** SpinBox's `up`/`down` stepper icons (`default_theme.cpp:616-623`) — the disabled state reuses the SAME asset (only the modulate colour differs, `nativeSolver.ts`'s own doc). */
export interface SpinBoxIcons {
  up: string;
  down: string;
}

export const SPIN_BOX_ICONS: SpinBoxIcons = {
  up: svgDataUrl(VALUE_UP_B64),
  down: svgDataUrl(VALUE_DOWN_B64),
};
