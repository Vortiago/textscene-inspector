/**
 * Godot's `LabelSettings` resource — the font/colour/outline/shadow/spacing
 * bundle a Label's `label_settings` property overrides its theme with
 * (`scene/resources/label_settings.h`).
 *
 * Scoped to the scalar fields `Label::_shape`/`NOTIFICATION_DRAW` actually
 * read for the glyphs this previewer draws: `line_spacing`, `font`,
 * `font_size`, `font_color`, `outline_size`, `outline_color`, `shadow_size`,
 * `shadow_color`, `shadow_offset`. `paragraph_spacing` and the stacked-
 * outline/stacked-shadow arrays (`label_settings.cpp:92-111`) decode nowhere
 * in this previewer — see the Label `comparison.md` for that render-side
 * limitation.
 *
 * Pure data — no THREE — so parser and linter paths can both read it.
 */
import type { Color } from '../../../utils/colorParser';
import type { Vector2 } from '../../../parser/vectors';

export interface LabelSettingsResource {
  /** `line_spacing`, real_t px. Godot default 3 (`label_settings.h:54`). */
  lineSpacing: number;
  /** `font` — the raw resource-reference text, or undefined when unset. Godot default null (no by-reference font swap in this previewer; see `comparison.md`). */
  font?: string;
  /** `font_size`. Godot default `Font::DEFAULT_FONT_SIZE` = 16 (`label_settings.h:58`). */
  fontSize: number;
  /** `font_color`. Godot default `Color(1, 1, 1)` (`label_settings.h:59`). */
  fontColor: Color;
  /** `outline_size`. Godot default 0 (`label_settings.h:61`). */
  outlineSize: number;
  /** `outline_color`. Godot default `Color(1, 1, 1)` (`label_settings.h:62`). */
  outlineColor: Color;
  /** `shadow_size` — the shadow's OWN outline-expand width, px. Godot default 1 (`label_settings.h:64`). */
  shadowSize: number;
  /** `shadow_color`. Godot default `Color(0, 0, 0, 0)` — transparent, so a Label draws no shadow until this is set (`label_settings.h:65`). */
  shadowColor: Color;
  /** `shadow_offset`. Godot default `Vector2(1, 1)` (`label_settings.h:66`). */
  shadowOffset: Vector2;
}
