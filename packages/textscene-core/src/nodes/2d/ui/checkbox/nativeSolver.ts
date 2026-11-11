/**
 * What CheckBox adds to Button (`scene/gui/check_box.cpp`): the check or radio icon it reserves as Button's
 * `_internal_margin` (`:96-101`) and draws over it (`:107-142`), its minimum size (`:64-79`) and its theme
 * defaults (`scene/theme/default_theme.cpp:274-313`).
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
import type { CheckBoxIcons } from '../../../../r3f/controls/native/themeIcons';
import type { CheckBoxProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { Rgba } from '../../../../godot/math/math';
import { HorizontalAlignment } from '../../../../godot/math/alignment';

export type CheckBoxIconKey = keyof CheckBoxIcons;

/**
 * `NOTIFICATION_DRAW` (`check_box.cpp:112-131`): a valid `button_group` swaps in the `radio_*`
 * pair, `is_disabled()` picks the `_disabled` variant, and `button_pressed` picks checked or
 * unchecked. `check_box.cpp` binds no `_mirrored` icon, so layout direction plays no part.
 */
export function resolveCheckBoxIconKey(props: CheckBoxProperties): CheckBoxIconKey {
  const radio = props.buttonGroup !== undefined;
  const disabled = props.disabled === true;
  const checked = props.buttonPressed === true;
  if (radio) {
    if (checked) return disabled ? 'radioCheckedDisabled' : 'radioChecked';
    return disabled ? 'radioUncheckedDisabled' : 'radioUnchecked';
  }
  if (checked) return disabled ? 'checkedDisabled' : 'checked';
  return disabled ? 'uncheckedDisabled' : 'unchecked';
}

/** Every vendored icon shares this authored size (`native/themeIcons.ts`: `checked.svg` et al, 16x16). */
export const CHECKBOX_ICON_NATURAL_SIZE: Vector2 = { x: 16, y: 16 };

/**
 * Each `CheckBoxIconKey` to the Theme item name Godot registers it under (`check_box.cpp:157-164`),
 * the key `SolveNode.icons` and `SolveNode.textureSlots` carry a themed answer under.
 */
export const CHECK_BOX_ICON_THEME_NAME: Record<CheckBoxIconKey, string> = {
  checked: 'checked',
  unchecked: 'unchecked',
  radioChecked: 'radio_checked',
  radioUnchecked: 'radio_unchecked',
  checkedDisabled: 'checked_disabled',
  uncheckedDisabled: 'unchecked_disabled',
  radioCheckedDisabled: 'radio_checked_disabled',
  radioUncheckedDisabled: 'radio_unchecked_disabled',
};

const CHECK_BOX_ICON_THEME_NAMES = Object.values(CHECK_BOX_ICON_THEME_NAME);

/**
 * Those of CheckBox's 8 icon slots that have a themed answer, for `SolveNode.textureSlots`. The walker has
 * already resolved the names (`SolveNode.icons`), and this turns them into size requests. PopupMenu draws
 * the same icons for a checkable item.
 */
export function checkIconSlotRequests(themedIcons: Parameters<typeof themedSlotRequests>[1]) {
  return themedSlotRequests(CHECK_BOX_ICON_THEME_NAMES, themedIcons);
}

/**
 * The size Godot draws the current icon at: its own, fitted, at the offset the largest icon sets
 * (`check_box.cpp:137-142`). An icon that reports size 0 draws nothing.
 */
function checkBoxDrawnIconSize(
  n: Pick<SolveNode, 'textureSlots' | 'constants'>,
  key: CheckBoxIconKey
): Vector2 {
  const own = n.textureSlots[CHECK_BOX_ICON_THEME_NAME[key]] ?? CHECKBOX_ICON_NATURAL_SIZE;
  return fitIconSize(own, buttonIconMaxWidth(n.constants));
}

/**
 * `CheckBox::get_icon_size` (`check_box.cpp:35-62`): the largest of all 8 icons, whichever is showing,
 * fitted to `icon_max_width`. The default theme registers all 8 (`default_theme.cpp:288-295`).
 */
function checkBoxFittedIconSize(n: Pick<SolveNode, 'textureSlots' | 'constants'>): Vector2 {
  const largest = largestThemedIconSize(
    n.textureSlots,
    CHECK_BOX_ICON_THEME_NAMES,
    CHECKBOX_ICON_NATURAL_SIZE
  );
  return fitIconSize(largest, buttonIconMaxWidth(n.constants));
}

/**
 * CheckBox as a Button: its font colours equal Button's (`default_theme.cpp:300-305`), its constructor
 * aligns the text LEFT (`check_box.cpp:174`), and the check is the internal margin of the leading side
 * (`:96-101`).
 */
export const CHECK_BOX_CLASS: ReservingButtonClass = {
  fontColors: BUTTON_DEFAULT_FONT_COLORS,
  textAlignment: HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
  reservedElement: (n) => ({ side: n.rtl ? 'right' : 'left', size: checkBoxFittedIconSize(n) }),
};

/** Button's `icon`, then the themed check icons. */
export const checkBoxTextureSlots: TextureSlotsFn = buttonTextureSlotsOf(
  CHECK_BOX_CLASS,
  (_node, themedIcons = {}) => checkIconSlotRequests(themedIcons)
);

/** `CheckBox::get_minimum_size` (`check_box.cpp:64-79`): Button's, with the check reserved beside the content. */
export const checkBoxMinimumSize: MinimumSizeFn = reservingMinimumSizeOf(CHECK_BOX_CLASS);

/**
 * Where `CheckBox::_notification` draws the icon `key` in a box of `rectSize` (`check_box.cpp:126-142`):
 * at the `normal` box's leading margin, whatever the draw state, and at the trailing one under RTL.
 * `int()` truncates the centring before `check_v_offset` is added (`:137`). The icon draws at its own
 * fitted size, unrounded, at the offset the largest icon sets.
 */
export function checkBoxCheckRect(
  n: ShareNode,
  theme: NativeTheme,
  key: CheckBoxIconKey,
  rectSize: Vector2
): Rect2 {
  const { contentMargin } = buttonNormalBox(n, theme);
  const reserved = checkBoxFittedIconSize(n);
  const drawn = checkBoxDrawnIconSize(n, key);
  return {
    x: n.rtl ? rectSize.x - contentMargin.right - reserved.x : contentMargin.left,
    y: Math.trunc((rectSize.y - reserved.y) / 2) + (n.constants.check_v_offset ?? 0),
    w: drawn.x,
    h: drawn.y,
  };
}

/**
 * The colour `CheckBox::_notification` draws the icon in (`check_box.cpp:139-142`): `checkbox_checked_color`
 * or `checkbox_unchecked_color`, both white (`default_theme.cpp:312-313`). The disabled icons carry their own dimming.
 */
export function checkBoxCheckColor(props: CheckBoxProperties, colors: SolveNode['colors']): Rgba {
  const key = props.buttonPressed ? 'checkbox_checked_color' : 'checkbox_unchecked_color';
  return colors[key] ?? WHITE_MODULATE;
}
