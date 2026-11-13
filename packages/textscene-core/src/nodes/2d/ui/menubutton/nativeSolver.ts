/**
 * What MenuButton changes of Button. `menu_button.cpp` overrides neither `get_minimum_size` nor
 * `NOTIFICATION_DRAW`, so it sizes and draws as a Button of `MENU_BUTTON_CLASS`. The "MenuButton" type of
 * `scene/theme/default_theme.cpp` (`:255-272`) differs from Button's only in `font_disabled_color` (`:268`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import type { ToggleDrawState } from '../../../../r3f/controls/native/buttonBase';
import { type Rgba } from '../../../../godot/math/math';
import {
  BUTTON_CLASS,
  BUTTON_DEFAULT_FONT_COLORS,
  buttonMinimumSizeOf,
  type ButtonClass,
} from '../button/nativeSolver';

/** `Color(1, 1, 1, 0.3)`: MenuButton's own disabled font colour (`default_theme.cpp:268`), not Button's `control_font_disabled_color` (`:161`). */
const MENU_BUTTON_DEFAULT_DISABLED_FONT_COLOR: Rgba = { r: 1, g: 1, b: 1, a: 0.3 };

/** MenuButton's font colour default for each draw state: Button's, but for its own disabled colour. */
const MENU_BUTTON_DEFAULT_FONT_COLORS: Readonly<Record<ToggleDrawState, Rgba>> = {
  ...BUTTON_DEFAULT_FONT_COLORS,
  disabled: MENU_BUTTON_DEFAULT_DISABLED_FONT_COLOR,
};

/** MenuButton as a Button: only its disabled font colour differs. */
export const MENU_BUTTON_CLASS: ButtonClass = {
  ...BUTTON_CLASS,
  fontColors: MENU_BUTTON_DEFAULT_FONT_COLORS,
};

/** `menu_button.cpp` does not override `get_minimum_size`, so MenuButton sizes as its Button base does. */
export const menuButtonMinimumSize: MinimumSizeFn = buttonMinimumSizeOf(MENU_BUTTON_CLASS);
