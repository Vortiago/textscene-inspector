/**
 * `is_color_overbright` (`scene/gui/color_picker.cpp:56-58`): any channel
 * past 1 — an HDR colour this engine's own single sRGB→linear conversion
 * cannot preview accurately, so both ColorPicker and ColorPickerButton draw
 * a warning glyph over it (`themeIcons.ts`'s `COLOR_PICKER_OVERBRIGHT_ICON`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
export function isColorOverbright(color: { r: number; g: number; b: number }): boolean {
  return color.r > 1 || color.g > 1 || color.b > 1;
}
