/**
 * MenuButton's native rect solver. `menu_button.cpp` overrides neither `get_minimum_size` nor
 * `NOTIFICATION_DRAW`, so it sizes through `buttonMinimumSize`. `scene/theme/default_theme.cpp`'s
 * "MenuButton" type (`:255-272`) differs from Button's only in `font_disabled_color` (`:268`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import type { ShareNode } from '../../../../r3f/controls/native/solveHandoff';
import { BUTTON_THEME_KEYS, type ToggleDrawState } from '../../../../r3f/controls/native/buttonBase';
import { type Rgba } from '../../../../godot/math/math';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
} from '../../../../r3f/controls/native/textTheme';
import { BUTTON_DEFAULT_FONT_COLORS, buttonMinimumSize } from '../button/nativeSolver';
import { defaultFontColorOf } from '../../../../r3f/controls/native/defaultThemeItems';
import type { MenuButtonProperties } from './types';

/** `Color(1, 1, 1, 0.3)`: MenuButton's own disabled font colour (`default_theme.cpp:268`), not Button's `control_font_disabled_color` (`:161`). */
const MENU_BUTTON_DEFAULT_DISABLED_FONT_COLOR: Rgba = { r: 1, g: 1, b: 1, a: 0.3 };

/** MenuButton's font colour default for each draw state: Button's, but for its own disabled colour. */
const MENU_BUTTON_DEFAULT_FONT_COLORS: Readonly<Record<ToggleDrawState, Rgba>> = {
  ...BUTTON_DEFAULT_FONT_COLORS,
  disabled: MENU_BUTTON_DEFAULT_DISABLED_FONT_COLOR,
};

/** MenuButton's theme font size and colour for `state`: its overrides, else the ancestor Theme chain, else the theme default, else MenuButton's literal. */
export function menuButtonTextTheme(
  n: ShareNode,
  props: MenuButtonProperties,
  state: ToggleDrawState,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = {
    fontSizePx: ctx.theme.fontSize,
    color: defaultFontColorOf(n, MENU_BUTTON_DEFAULT_FONT_COLORS, state),
  };
  return resolveTextTheme(n, props, BUTTON_THEME_KEYS[state], defaults);
}

/** `menu_button.cpp` does not override `get_minimum_size`, so MenuButton sizes as its Button base does. */
export const menuButtonMinimumSize: MinimumSizeFn = buttonMinimumSize;
