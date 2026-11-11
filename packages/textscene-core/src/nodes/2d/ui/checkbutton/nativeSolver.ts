/**
 * What CheckButton adds to Button (`scene/gui/check_button.cpp`): the toggle icon it reserves as Button's
 * `_internal_margin` (`:96-104`) and draws over it (`:106-146`), its minimum size (`:64-79`) and its theme
 * defaults (`scene/theme/default_theme.cpp:316-353`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn, TextureSlotsFn } from '../../../../r3f/controls/native/solverRegistry';
import { themedSlotRequests } from '../../../../r3f/controls/native/solverRegistry';
import type { ShareNode, SolveNode } from '../../../../r3f/controls/native/solveTree';
import { fitIconSize, largestThemedIconSize } from '../../../../r3f/controls/native/buttonBase';
import { WHITE_MODULATE } from '../../../../r3f/canvasItemModulate';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import {
  BUTTON_DEFAULT_FONT_COLORS,
  buttonIconMaxWidth,
  buttonNormalBox,
  buttonTextureSlotsOf,
  reservingMinimumSizeOf,
  type ReservingButtonClass,
} from '../button/nativeSolver';
import type { CheckButtonIcons } from '../../../../r3f/controls/native/themeIcons';
import { CHECK_BUTTON_ICON_NATURAL_SIZE } from '../../../../r3f/controls/native/themeIcons';
import type { CheckButtonProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { Rgba } from '../../../../godot/math/math';
import { HorizontalAlignment } from '../../../../godot/math/alignment';

export type CheckButtonIconKey = keyof CheckButtonIcons;

/**
 * `NOTIFICATION_DRAW` (`check_button.cpp:105-127`): `is_layout_rtl()` swaps in the `_mirrored`
 * icon table, `is_disabled()` picks the `_disabled` variant, and `button_pressed` picks the
 * checked ("on") or unchecked ("off") icon.
 */
export function resolveCheckButtonIconKey(props: CheckButtonProperties, rtl: boolean): CheckButtonIconKey {
  const disabled = props.disabled === true;
  const checked = props.buttonPressed === true;
  if (rtl) {
    if (checked) return disabled ? 'checkedDisabledMirrored' : 'checkedMirrored';
    return disabled ? 'uncheckedDisabledMirrored' : 'uncheckedMirrored';
  }
  if (checked) return disabled ? 'checkedDisabled' : 'checked';
  return disabled ? 'uncheckedDisabled' : 'unchecked';
}

/** Each `CheckButtonIconKey` to the Theme item name Godot registers it under (`check_button.cpp:152-159`). */
export const CHECK_BUTTON_ICON_THEME_NAME: Record<CheckButtonIconKey, string> = {
  checked: 'checked',
  unchecked: 'unchecked',
  checkedDisabled: 'checked_disabled',
  uncheckedDisabled: 'unchecked_disabled',
  checkedMirrored: 'checked_mirrored',
  uncheckedMirrored: 'unchecked_mirrored',
  checkedDisabledMirrored: 'checked_disabled_mirrored',
  uncheckedDisabledMirrored: 'unchecked_disabled_mirrored',
};

const CHECK_BUTTON_ICON_THEME_NAMES = Object.values(CHECK_BUTTON_ICON_THEME_NAME);

/**
 * The size Godot draws the current icon at: its own, fitted, at the offset the larger icon sets
 * (`check_button.cpp:133-145`). An icon that reports size 0 draws nothing.
 */
function checkButtonDrawnIconSize(
  n: Pick<SolveNode, 'textureSlots' | 'constants'>,
  key: CheckButtonIconKey
): Vector2 {
  const own = n.textureSlots[CHECK_BUTTON_ICON_THEME_NAME[key]] ?? CHECK_BUTTON_ICON_NATURAL_SIZE;
  return fitIconSize(own, buttonIconMaxWidth(n.constants));
}

/**
 * The colour `CheckButton::_notification` draws the toggle in (`check_button.cpp:142-145`):
 * `button_checked_color` or `button_unchecked_color`, both white (`default_theme.cpp:352-353`). The
 * `_disabled` icons carry their own dimming.
 */
export function checkButtonIconColor(props: CheckButtonProperties, colors: SolveNode['colors']): Rgba {
  const key = props.buttonPressed ? 'button_checked_color' : 'button_unchecked_color';
  return colors[key] ?? WHITE_MODULATE;
}

/**
 * `CheckButton::get_icon_size` (`check_button.cpp:35-65`): the larger of the checked and unchecked icons
 * that the node's `disabled` and layout direction select, unlike CheckBox's largest of all 8, fitted to
 * `icon_max_width`.
 */
function checkButtonFittedIconSize(
  n: Pick<SolveNode, 'node' | 'textureSlots' | 'constants' | 'rtl'>
): Vector2 {
  const props = n.node.properties as CheckButtonProperties;
  const names = [true, false].map(
    (buttonPressed) =>
      CHECK_BUTTON_ICON_THEME_NAME[resolveCheckButtonIconKey({ ...props, buttonPressed }, n.rtl)]
  );
  const largest = largestThemedIconSize(n.textureSlots, names, CHECK_BUTTON_ICON_NATURAL_SIZE);
  return fitIconSize(largest, buttonIconMaxWidth(n.constants));
}

/**
 * CheckButton as a Button: its font colours equal Button's (`default_theme.cpp:340-345`), its constructor
 * aligns the text LEFT (`check_button.cpp:174`), and the toggle is the internal margin of the trailing
 * side (`:96-104`).
 */
export const CHECK_BUTTON_CLASS: ReservingButtonClass = {
  fontColors: BUTTON_DEFAULT_FONT_COLORS,
  textAlignment: HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
  reservedElement: (n) => ({ side: n.rtl ? 'left' : 'right', size: checkButtonFittedIconSize(n) }),
};

/** Button's `icon`, then those of CheckButton's 8 icons that a theme sets. */
export const checkButtonTextureSlots: TextureSlotsFn = buttonTextureSlotsOf(
  CHECK_BUTTON_CLASS,
  (_node, themedIcons = {}) => themedSlotRequests(CHECK_BUTTON_ICON_THEME_NAMES, themedIcons)
);

/** `CheckButton::get_minimum_size` (`check_button.cpp:64-79`): Button's, with the toggle reserved beside the content. */
export const checkButtonMinimumSize: MinimumSizeFn = reservingMinimumSizeOf(CHECK_BUTTON_CLASS);

/**
 * Where `CheckButton::_notification` draws the icon `key` in a box of `rectSize` (`check_button.cpp:129-145`):
 * short of the `normal` box's trailing margin, whatever the draw state, and at the leading one under RTL.
 * Unrounded: an odd height leaves the toggle on a half pixel (`:137`). The icon draws at its own fitted
 * size, at the offset the larger icon sets.
 */
export function checkButtonToggleRect(
  n: ShareNode,
  theme: NativeTheme,
  key: CheckButtonIconKey,
  rectSize: Vector2
): Rect2 {
  const { contentMargin } = buttonNormalBox(n, theme);
  const reserved = checkButtonFittedIconSize(n);
  const drawn = checkButtonDrawnIconSize(n, key);
  return {
    x: n.rtl ? contentMargin.left : rectSize.x - (reserved.x + contentMargin.right),
    y: (rectSize.y - reserved.y) / 2 + (n.constants.check_v_offset ?? 0),
    w: drawn.x,
    h: drawn.y,
  };
}
