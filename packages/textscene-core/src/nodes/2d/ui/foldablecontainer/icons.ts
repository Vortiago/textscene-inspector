/**
 * FoldableContainer's four fold-state arrow icons, vendored as inline `data:`
 * URLs — the same technique `r3f/controls/native/themeIcons.ts` uses for
 * CheckBox/OptionButton/SplitContainer, kept local since FoldableContainer is
 * their only consumer.
 *
 * `scene/theme/default_theme.cpp:1329-1332`:
 *   set_icon("expanded_arrow",          "FoldableContainer", icons["arrow_down"])
 *   set_icon("expanded_arrow_mirrored", "FoldableContainer", icons["arrow_up"])
 *   set_icon("folded_arrow",            "FoldableContainer", icons["arrow_right"])
 *   set_icon("folded_arrow_mirrored",   "FoldableContainer", icons["arrow_left"])
 *
 * `FoldableContainer::_get_title_icon` (`foldable_container.cpp:428-435`)
 * never picks the RTL-only `folded_arrow_mirrored` in this codebase (RTL is
 * out of scope, matching every other native Control painter here) — vendored
 * anyway since `expanded_arrow_mirrored` is reachable through `title_position`
 * alone and the pair is one file.
 *
 * The bytes below are unmodified copies of `scene/theme/icons/arrow_{down,up,
 * right,left}.svg` from Godot 4.6.3. Licence: Godot Engine, MIT — see
 * THIRD-PARTY-NOTICES.md.
 */

function svgDataUrl(base64: string): string {
  return `data:image/svg+xml;base64,${base64}`;
}

/** `scene/theme/icons/arrow_down.svg` (16x16) — FoldableContainer's `expanded_arrow`. */
const ARROW_DOWN_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYjJiMmIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIuNDUiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTUgNyAzIDMgMy0zIi8+PC9zdmc+Cg==';

/** `scene/theme/icons/arrow_up.svg` (16x16) — FoldableContainer's `expanded_arrow_mirrored` (used at `title_position = Bottom`, not for RTL). */
const ARROW_UP_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYjJiMmIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIuNDUiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTExLjAxMTA2MyA5Ljk3NzYyNDYtMy4wMjIyMDk0LTIuOTc3NjI0Ni0yLjk3NzYyNDcgMy4wMjIyMSIvPjwvc3ZnPgo=';

/** `scene/theme/icons/arrow_right.svg` (16x16) — FoldableContainer's `folded_arrow`. */
const ARROW_RIGHT_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYjJiMmIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIuNDUiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTYgMTEgMy0zLTMtMyIvPjwvc3ZnPgo=';

/** `scene/theme/icons/arrow_left.svg` (16x16) — FoldableContainer's `folded_arrow_mirrored` (RTL only, never selected here). */
const ARROW_LEFT_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHBhdGggZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYjJiMmIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1vcGFjaXR5PSIuNDUiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTkgMTEtMy0zIDMtMyIvPjwvc3ZnPgo=';

export interface FoldableContainerIcons {
  expandedArrow: string;
  expandedArrowMirrored: string;
  foldedArrow: string;
  foldedArrowMirrored: string;
}

export const FOLDABLE_CONTAINER_ICONS: FoldableContainerIcons = {
  expandedArrow: svgDataUrl(ARROW_DOWN_B64),
  expandedArrowMirrored: svgDataUrl(ARROW_UP_B64),
  foldedArrow: svgDataUrl(ARROW_RIGHT_B64),
  foldedArrowMirrored: svgDataUrl(ARROW_LEFT_B64),
};
