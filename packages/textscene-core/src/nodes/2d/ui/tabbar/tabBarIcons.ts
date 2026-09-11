/**
 * TabBar's own vendored default-theme icons — `close.svg`, `scroll_button_
 * left.svg`, `scroll_button_right.svg` (`scene/theme/icons/`), all 16x16.
 * `nativeTheme.ts`/`themeIcons.ts` cannot be extended from this slice (see
 * this packet's own brief), so these are vendored here in the SAME shape
 * `themeIcons.ts` already establishes (base64 SVG bytes, unmodified).
 *
 * `*_hl` (highlight/hover) variants are never vendored: this is a static
 * previewer with no pointer state (`buttonBase.ts`'s own precedent), so the
 * base icon is the only one ever drawn.
 *
 * Licence: Godot Engine, MIT — see THIRD-PARTY-NOTICES.md.
 */

function svgDataUrl(base64: string): string {
  return `data:image/svg+xml;base64,${base64}`;
}

/** `scene/theme/icons/close.svg` (16x16) — `theme_cache.close_icon`. */
const CLOSE_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIuNzUiIGQ9Im0xIDMgMi0yIDUgNSA1LTUgMiAyLTUgNSA1IDUtMiAyLTUtNS01IDUtMi0yIDUtNXoiLz48L3N2Zz4K';

/** `scene/theme/icons/scroll_button_right.svg` (16x16) — `theme_cache.increment_icon`. */
const SCROLL_BUTTON_RIGHT_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjYiIGZpbGw9IiNmZWZmZmUiIGZpbGwtb3BhY2l0eT0iLjc1Ii8+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMWExYTFhIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIuNjUiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTcgNSAzIDMtMyAzIi8+PC9zdmc+Cg==';

/** `scene/theme/icons/scroll_button_left.svg` (16x16) — `theme_cache.decrement_icon`. */
const SCROLL_BUTTON_LEFT_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PGNpcmNsZSBjeD0iOCIgY3k9IjgiIHI9IjYiIGZpbGw9IiNmZWZmZmUiIGZpbGwtb3BhY2l0eT0iLjc1Ii8+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMWExYTFhIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIuNjUiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTkgNS0zIDMgMyAzIi8+PC9zdmc+Cg==';

export interface TabBarIcons {
  close: string;
  incrementScroll: string;
  decrementScroll: string;
}

export const TAB_BAR_ICONS: TabBarIcons = {
  close: svgDataUrl(CLOSE_B64),
  incrementScroll: svgDataUrl(SCROLL_BUTTON_RIGHT_B64),
  decrementScroll: svgDataUrl(SCROLL_BUTTON_LEFT_B64),
};

/** Every icon above is authored at 16x16 — `themeIcons.ts`'s vendored icons are never rescaled by the project theme scale either (`spinbox/nativeSolver.ts`'s own doc on `SPIN_BOX_ARROW_ICON_SIZE`), an established limitation this slice inherits rather than introduces. */
export const TAB_BAR_ICON_SIZE = 16;
