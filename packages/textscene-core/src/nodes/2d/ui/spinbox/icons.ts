/**
 * SpinBox's vendored default-theme icons: `scene/theme/icons/value_up.svg`/`value_down.svg` (Godot
 * 4.6.3, MIT), the `"up"`/`"down"` theme icons (`default_theme.cpp:616-619,620-623`). They stay local,
 * as `checkbox`'s `CHECK_BOX_ICONS` do, since `native/themeIcons.ts` does not export `svgDataUrl`.
 *
 * Licence: Godot Engine, MIT. See THIRD-PARTY-NOTICES.md.
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

/** SpinBox's `up`/`down` stepper icons (`default_theme.cpp:616-623`). The disabled state reuses the same asset, and only the modulate differs. */
export interface SpinBoxIcons {
  up: string;
  down: string;
}

export const SPIN_BOX_ICONS: SpinBoxIcons = {
  up: svgDataUrl(VALUE_UP_B64),
  down: svgDataUrl(VALUE_DOWN_B64),
};
