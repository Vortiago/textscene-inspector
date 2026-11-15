/**
 * The default theme's ColorPicker and ColorPresetButton (`scene/theme/default_theme.cpp:1071-1086`,
 * `:1153-1161`). Their icons are not in the table. ColorPickerButton lives in `button.ts`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { scaledPx, STYLE_FILL } from '../theme.js';
import { focusStyleBox } from './button.js';
import type { DefaultThemeTypes } from './defaultTheme.js';
import { allSides, makeFlatStyleBox, withCornerRadiusAll } from './styleBoxes.js';
import { typeItems, WHITE, whiteAt } from './typeItems.js';

export function colorPickerTypes(scale: number): DefaultThemeTypes {
  const rounded = (length: number) => scaledPx(length, scale);
  const focus = focusStyleBox(scale);
  const focusCircle = withCornerRadiusAll(
    makeFlatStyleBox(scale, STYLE_FILL.focus, { drawCenter: false, borderWidth: 2 }),
    rounded(256),
    rounded(32)
  );
  // `set_anti_aliased(false)` (`:1158`) is not a field of the table's box.
  const presetForeground = withCornerRadiusAll(
    makeFlatStyleBox(scale, WHITE, { margin: allSides(2) }),
    rounded(2),
    rounded(2)
  );
  return {
    ColorPicker: typeItems({
      styles: { sample_focus: focus, picker_focus_rectangle: focus, picker_focus_circle: focusCircle },
      colors: { focused_not_editing_cursor_color: whiteAt(0.275) },
      constants: {
        margin: rounded(4),
        sv_width: rounded(256),
        sv_height: rounded(256),
        h_width: rounded(30),
        label_width: rounded(10),
        center_slider_grabbers: 1,
      },
    }),
    ColorPresetButton: typeItems({ styles: { preset_fg: presetForeground, preset_focus: focus } }),
  };
}
