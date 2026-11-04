/**
 * Godot's `LabelSettings` (`scene/resources/label_settings.h`): the font,
 * colour, outline, shadow and spacing a Label's `label_settings` overrides its
 * theme with: the fields `Label::_shape` and `NOTIFICATION_DRAW` read, with the stacked
 * outline and shadow arrays (`label_settings.cpp:110-128`).
 */
import type { Rgba } from '../../../godot/math/math';
import type { Vector2 } from '../../../godot/math/vector';

/** One `stacked_outline_N` element (`label_settings.h:43-46`). */
export interface StackedOutline {
  /** `size`, px. Default 0, which draws nothing. */
  size: number;
  /** `color`. Default `Color()`, opaque black (`core/math/color.h:251`). */
  color: Rgba;
}

/** One `stacked_shadow_N` element (`label_settings.h:47-51`). */
export interface StackedShadow {
  /** `offset`, px. A `Vector2i`, default `(1, 1)`. */
  offset: Vector2;
  /** `color`. Default opaque black. */
  color: Rgba;
  /** `outline_size`, px. Default 0, which draws no outline for this shadow. */
  outlineSize: number;
}

export interface LabelSettingsResource {
  /** `line_spacing`, real_t px. Godot default 3 (`label_settings.h:54`). */
  lineSpacing: number;
  /** `paragraph_spacing`, real_t px. Godot default 0 (`label_settings.h:55`). */
  paragraphSpacing: number;
  /** `font`: the raw resource-reference text, or undefined when unset. Godot default null. `buildSolveTree` resolves it in the file that wrote the settings. */
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
  /** `stacked_outline_N`, in index order. Empty at a count of 0 or less. */
  stackedOutlines: StackedOutline[];
  /** `stacked_shadow_N`, in index order. Empty at a count of 0 or less. */
  stackedShadows: StackedShadow[];
}
