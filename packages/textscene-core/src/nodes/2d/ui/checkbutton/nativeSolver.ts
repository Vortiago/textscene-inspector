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
import {
  buttonIconSlotRequest,
  fitIconSize,
  internalMarginAt,
} from '../../../../r3f/controls/native/buttonBase';
import { buttonBoxesOf } from '../../../../r3f/controls/native/defaultThemeItems';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { BUTTON_DEFAULT_FONT_COLORS, reservingMinimumSizeOf, type ButtonClass } from '../button/nativeSolver';
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

/** Button's own `icon` and those of CheckButton's 8 icon slots that have a themed answer, as `checkBoxTextureSlots` does for CheckBox. */
export const checkButtonTextureSlots: TextureSlotsFn = (node, themedIcons = {}) => [
  buttonIconSlotRequest((node.properties as CheckButtonProperties).icon, themedIcons),
  ...themedSlotRequests(CHECK_BUTTON_ICON_THEME_NAMES, themedIcons),
];

/**
 * `CheckButton::get_icon_size` (`check_button.cpp:35-65`): the max over the two icons the current
 * `disabled` state and layout direction select, unlike CheckBox's max over all 8. A slot no theme
 * touched falls back to the vendored default's size.
 */
function checkButtonIconNaturalSize(
  n: Pick<SolveNode, 'textureSlots'>,
  disabled: boolean,
  rtl: boolean
): Vector2 {
  const names: readonly CheckButtonIconKey[] = rtl
    ? disabled
      ? ['checkedDisabledMirrored', 'uncheckedDisabledMirrored']
      : ['checkedMirrored', 'uncheckedMirrored']
    : disabled
      ? ['checkedDisabled', 'uncheckedDisabled']
      : ['checked', 'unchecked'];
  let w = 0;
  let h = 0;
  for (const key of names) {
    const size = n.textureSlots[CHECK_BUTTON_ICON_THEME_NAME[key]] ?? CHECK_BUTTON_ICON_NATURAL_SIZE;
    w = Math.max(w, size.x);
    h = Math.max(h, size.y);
  }
  return { x: w, y: h };
}

/**
 * The size Godot draws the current icon at: its own, fitted, at the offset the larger icon sets
 * (`check_button.cpp:133-145`). An icon that reports size 0 draws nothing.
 */
function checkButtonDrawnIconSize(
  n: Pick<SolveNode, 'textureSlots' | 'constants'>,
  key: CheckButtonIconKey
): Vector2 {
  const own = n.textureSlots[CHECK_BUTTON_ICON_THEME_NAME[key]] ?? CHECK_BUTTON_ICON_NATURAL_SIZE;
  return fitIconSize(own, checkButtonIconMaxWidth(n.constants));
}

/** `button_checked_color` and `button_unchecked_color`, both `Color(1, 1, 1)` (`default_theme.cpp:352-353`) and overridable. Read whatever `disabled` says: the `_disabled` icons carry the dimming (`check_button.cpp:139-141`). */
const CHECKBUTTON_ICON_MODULATE_DEFAULT: Rgba = { r: 1, g: 1, b: 1, a: 1 };

export function checkButtonIconColor(props: CheckButtonProperties, colors: SolveNode['colors']): Rgba {
  const key = props.buttonPressed ? 'button_checked_color' : 'button_unchecked_color';
  return colors[key] ?? CHECKBUTTON_ICON_MODULATE_DEFAULT;
}

/** `icon_max_width`: `check_button.cpp` binds none, so Button's default (`0`, unclamped) applies through the shared `theme_override_constants` key. */
function checkButtonIconMaxWidth(constants: SolveNode['constants']): number {
  return constants.icon_max_width ?? 0;
}

/** `CheckButton::get_icon_size` (`check_button.cpp:35-62`): the larger of the two icons the node's `disabled` and layout direction select, fitted to `icon_max_width`. */
function checkButtonFittedIconSize(
  n: Pick<SolveNode, 'node' | 'textureSlots' | 'constants' | 'rtl'>
): Vector2 {
  const isDisabled = (n.node.properties as CheckButtonProperties).disabled === true;
  return fitIconSize(checkButtonIconNaturalSize(n, isDisabled, n.rtl), checkButtonIconMaxWidth(n.constants));
}

/**
 * CheckButton as a Button: its font colours equal Button's (`default_theme.cpp:340-345`), its constructor
 * aligns the text LEFT (`check_button.cpp:174`), and the toggle is the internal margin of the trailing
 * side (`:96-104`).
 */
export const CHECK_BUTTON_CLASS: ButtonClass = {
  fontColors: BUTTON_DEFAULT_FONT_COLORS,
  textAlignment: HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
  internalMargin: (n) => internalMarginAt(n.rtl ? 'left' : 'right', checkButtonFittedIconSize(n).x),
};

/** `CheckButton::get_minimum_size` (`check_button.cpp:64-79`): Button's, with the toggle reserved beside the content. */
export const checkButtonMinimumSize: MinimumSizeFn = reservingMinimumSizeOf(
  CHECK_BUTTON_CLASS,
  checkButtonFittedIconSize
);

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
  const { contentMargin } = n.styleBoxes.normal ?? buttonBoxesOf(n, theme).normal;
  const reserved = checkButtonFittedIconSize(n);
  const drawn = checkButtonDrawnIconSize(n, key);
  return {
    x: n.rtl ? contentMargin.left : rectSize.x - (reserved.x + contentMargin.right),
    y: (rectSize.y - reserved.y) / 2 + (n.constants.check_v_offset ?? 0),
    w: drawn.x,
    h: drawn.y,
  };
}
