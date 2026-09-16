/**
 * Godot's `LabelSettings` resource — the font/colour/outline/spacing bundle a
 * Label's `label_settings` property overrides its theme with
 * (`scene/resources/label_settings.h`).
 *
 * Scoped to the scalar fields `Label::_shape`/`NOTIFICATION_DRAW` actually
 * read for the glyphs this previewer draws: `line_spacing`, `font`,
 * `font_size`, `font_color`, `outline_size`, `outline_color`. `paragraph_spacing`,
 * the shadow fields and the stacked-outline/stacked-shadow arrays
 * (`label_settings.cpp:92-111`) decode nowhere in this previewer, which draws
 * no font shadow or outline for ANY text control — see the Label
 * `comparison.md` for the render-side limitation.
 *
 * Pure data — no THREE — so parser and linter paths can both read it.
 */
import type { Color } from '../../../utils/colorParser';

export interface LabelSettingsResource {
  /** `line_spacing`, real_t px. Godot default 3 (`label_settings.h:54`). */
  lineSpacing: number;
  /** `font` — the raw resource-reference text, or undefined when unset. Godot default null (no by-reference font swap in this previewer; see `comparison.md`). */
  font?: string;
  /** `font_size`. Godot default `Font::DEFAULT_FONT_SIZE` = 16 (`label_settings.h:58`). */
  fontSize: number;
  /** `font_color`. Godot default `Color(1, 1, 1)` (`label_settings.h:59`). */
  fontColor: Color;
  /** `outline_size`. Godot default 0 (`label_settings.h:61`). Decoded but not drawn — see `comparison.md`. */
  outlineSize: number;
  /** `outline_color`. Godot default `Color(1, 1, 1)` (`label_settings.h:62`). Decoded but not drawn — see `comparison.md`. */
  outlineColor: Color;
}
