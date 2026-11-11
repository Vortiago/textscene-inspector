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
import {
  buttonIconSlotRequest,
  fitIconSize,
  internalMarginAt,
} from '../../../../r3f/controls/native/buttonBase';
import { buttonBoxesOf } from '../../../../r3f/controls/native/defaultThemeItems';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { BUTTON_DEFAULT_FONT_COLORS, reservingMinimumSizeOf, type ButtonClass } from '../button/nativeSolver';
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

/** Button's own `icon`, then the themed check icons. */
export const checkBoxTextureSlots: TextureSlotsFn = (node, themedIcons = {}) => [
  buttonIconSlotRequest((node.properties as CheckBoxProperties).icon),
  ...checkIconSlotRequests(themedIcons),
];

/**
 * `CheckBox::get_icon_size` (`check_box.cpp:35-62`): the max over all 8 icons, whichever is showing.
 * A slot no theme touched falls back to the vendored default's size, since the default theme
 * registers all 8 (`default_theme.cpp:288-295`).
 */
function checkBoxIconNaturalSize(n: Pick<SolveNode, 'textureSlots'>): Vector2 {
  let w = 0;
  let h = 0;
  for (const name of CHECK_BOX_ICON_THEME_NAMES) {
    const size = n.textureSlots[name] ?? CHECKBOX_ICON_NATURAL_SIZE;
    w = Math.max(w, size.x);
    h = Math.max(h, size.y);
  }
  return { x: w, y: h };
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
  return fitIconSize(own, checkBoxIconMaxWidth(n.constants));
}

/** `icon_max_width`: CheckBox registers none, so Button's default (`0`, unclamped) applies through the shared `theme_override_constants` key. */
function checkBoxIconMaxWidth(constants: SolveNode['constants']): number {
  return constants.icon_max_width ?? 0;
}

/** `CheckBox::get_icon_size` (`check_box.cpp:35-62`): the largest of the 8 icons, fitted to `icon_max_width`. */
function checkBoxFittedIconSize(n: Pick<SolveNode, 'textureSlots' | 'constants'>): Vector2 {
  return fitIconSize(checkBoxIconNaturalSize(n), checkBoxIconMaxWidth(n.constants));
}

/**
 * CheckBox as a Button: its font colours equal Button's (`default_theme.cpp:300-305`), its constructor
 * aligns the text LEFT (`check_box.cpp:174`), and the check is the internal margin of the leading side
 * (`:96-101`).
 */
export const CHECK_BOX_CLASS: ButtonClass = {
  fontColors: BUTTON_DEFAULT_FONT_COLORS,
  textAlignment: HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
  internalMargin: (n) => internalMarginAt(n.rtl ? 'right' : 'left', checkBoxFittedIconSize(n).x),
};

/** `CheckBox::get_minimum_size` (`check_box.cpp:64-79`): Button's, with the check reserved beside the content. */
export const checkBoxMinimumSize: MinimumSizeFn = reservingMinimumSizeOf(
  CHECK_BOX_CLASS,
  checkBoxFittedIconSize
);

/**
 * Where `CheckBox::_notification` draws the icon `key` in a box of `rectSize` (`check_box.cpp:126-142`):
 * at the `normal` box's leading margin, whatever the draw state, and at the trailing one under RTL.
 * `int()` truncates the centring before `check_v_offset` is added (`:131`). The icon draws at its own
 * fitted size, unrounded, at the offset the largest icon sets.
 */
export function checkBoxCheckRect(
  n: ShareNode,
  theme: NativeTheme,
  key: CheckBoxIconKey,
  rectSize: Vector2
): Rect2 {
  const { contentMargin } = n.styleBoxes.normal ?? buttonBoxesOf(n, theme).normal;
  const reserved = checkBoxFittedIconSize(n);
  const drawn = checkBoxDrawnIconSize(n, key);
  return {
    x: n.rtl ? rectSize.x - contentMargin.right - reserved.x : contentMargin.left,
    y: Math.trunc((rectSize.y - reserved.y) / 2) + (n.constants.check_v_offset ?? 0),
    w: drawn.x,
    h: drawn.y,
  };
}

/** `checkbox_checked_color` and `checkbox_unchecked_color`, both `Color(1, 1, 1)` (`default_theme.cpp:312-313`): the disabled icons carry their own dimming. */
const CHECK_BOX_ICON_MODULATE_DEFAULT: Rgba = { r: 1, g: 1, b: 1, a: 1 };

/** The modulate `CheckBox::_notification` draws the icon with (`check_box.cpp:139-142`). */
export function checkBoxCheckColor(props: CheckBoxProperties, colors: SolveNode['colors']): Rgba {
  const key = props.buttonPressed ? 'checkbox_checked_color' : 'checkbox_unchecked_color';
  return colors[key] ?? CHECK_BOX_ICON_MODULATE_DEFAULT;
}
