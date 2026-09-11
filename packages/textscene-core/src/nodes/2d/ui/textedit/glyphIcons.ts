/**
 * TextEdit's own `tab`/`space` visual-whitespace icons — vendored inline
 * `data:` URLs, the same pattern `native/themeIcons.ts` uses (that module is
 * off-limits to this packet, so these live here instead; CodeEdit's painter
 * imports them from this file rather than duplicating them).
 *
 * `scene/theme/default_theme.cpp:457-458`:
 *
 *     theme->set_icon("tab", "TextEdit", icons["text_edit_tab"]);
 *     theme->set_icon("space", "TextEdit", icons["text_edit_space"]);
 *
 * (CodeEdit sets the identical two keys to the identical two icons,
 * `default_theme.cpp:490-491`.) The bytes below are unmodified copies of
 * `scene/theme/icons/text_edit_tab.svg` / `text_edit_space.svg` from Godot
 * 4.6.3. Licence: Godot Engine, MIT — see THIRD-PARTY-NOTICES.md.
 */

function svgDataUrl(base64: string): string {
  return `data:image/svg+xml;base64,${base64}`;
}

/** `scene/theme/icons/text_edit_tab.svg` (8x8). */
const TEXT_EDIT_TAB_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxwYXRoIGZpbGw9IiNiMmIyYjIiIGZpbGwtb3BhY2l0eT0iLjI1IiBkPSJNNiAwdjhoMlYwek0xIDBhMSAxIDAgMCAwLS42OTMgMS43MDVMMi42IDMuOTk4LjMwNyA2LjI5MUExIDEgMCAwIDAgMS43MiA3LjcwNWwzLTNhMSAxIDAgMCAwIDAtMS40MTRsLTMtM0ExIDEgMCAwIDAgMSAweiIvPjwvc3ZnPg==';

/** `scene/theme/icons/text_edit_space.svg` (8x8). */
const TEXT_EDIT_SPACE_B64 =
  'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxjaXJjbGUgY3g9IjQiIGN5PSI0IiByPSIxLjUiIGZpbGw9IiNiMmIyYjIiIGZpbGwtb3BhY2l0eT0iLjI1Ii8+PC9zdmc+';

export interface TextEditGlyphIcons {
  tab: string;
  space: string;
}

export const TEXT_EDIT_GLYPH_ICONS: TextEditGlyphIcons = {
  tab: svgDataUrl(TEXT_EDIT_TAB_B64),
  space: svgDataUrl(TEXT_EDIT_SPACE_B64),
};
