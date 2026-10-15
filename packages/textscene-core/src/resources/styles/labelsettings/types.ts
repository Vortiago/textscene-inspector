/**
 * Godot's `LabelSettings` (`scene/resources/label_settings.h`): the font,
 * colour, outline, shadow and spacing a Label's `label_settings` overrides its
 * theme with. Only the scalar fields `Label::_shape` and `NOTIFICATION_DRAW` read.
 * `paragraph_spacing` and the stacked arrays (`label_settings.cpp:92-111`) are not decoded.
 */
import type { Rgba } from '../../../godot/math';
import type { Vector2 } from '../../../godot/vector';

export interface LabelSettingsResource {
  /** `line_spacing`, real_t px. Godot default 3 (`label_settings.h:54`). */
  lineSpacing: number;
  /** `font`: the raw resource-reference text, or undefined when unset. Godot default null. The previewer does not swap the font. */
  font?: string;
  /** `font_size`. Godot default `Font::DEFAULT_FONT_SIZE` = 16 (`label_settings.h:58`). */
  fontSize: number;
  /** `font_color`. Godot default `Color(1, 1, 1)` (`label_settings.h:59`). */
  fontColor: Rgba;
  /** `outline_size`. Godot default 0 (`label_settings.h:61`). */
  outlineSize: number;
  /** `outline_color`. Godot default `Color(1, 1, 1)` (`label_settings.h:62`). */
  outlineColor: Rgba;
  /** `shadow_size`: the shadow's own outline-expand width, px. Godot default 1 (`label_settings.h:64`). */
  shadowSize: number;
  /** `shadow_color`. Godot default `Color(0, 0, 0, 0)`, transparent (`label_settings.h:65`). */
  shadowColor: Rgba;
  /** `shadow_offset`. Godot default `Vector2(1, 1)` (`label_settings.h:66`). */
  shadowOffset: Vector2;
}
