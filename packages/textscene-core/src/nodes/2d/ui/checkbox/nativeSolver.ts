/**
 * CheckBox's native (WebGL canvas) rect solver and content layout: `get_minimum_size`, `get_icon_size`
 * and `_notification` (`scene/gui/check_box.cpp`) with the theme defaults
 * (`scene/theme/default_theme.cpp:274-313`). It ports the placement itself: `buttonBase.ts` does not
 * model Button's `_internal_margin` (`Button::_set_internal_margin`, `check_box.cpp:96-101`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type {
  MinimumSizeFn,
  SolveContext,
  TextureSlotRequest,
  TextureSlotsFn,
} from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import {
  buttonTextAlignShiftPx,
  centredTextTopPx,
  fitIconSize,
  HORIZONTAL_ALIGNMENT_RIGHT,
  tintColor,
} from '../../../../r3f/controls/native/buttonBase';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import type { CheckBoxIcons } from '../../../../r3f/controls/native/themeIcons';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import type { ControlColor } from '../control/types';
import type { CheckBoxProperties } from './types';

/**
 * CheckBox's theme font key, `SceneStringName(font)`, registered under CheckBox's own type
 * (`scene/theme/default_theme.cpp:297`), so the lookup never walks to Button's. This module
 * and `Component.tsx` both pass it to `resolveNodeFontMetrics`, so they agree on the font.
 */
export const CHECKBOX_THEME_FONT_KEY = 'font';

// Re-exported so Component.tsx can build on the shared, Button-generic
// pieces without importing `buttonBase.ts` a second time under a different name.
export { fitIconSize, tintColor };


/**
 * `BaseButton::get_draw_mode` (`scene/gui/base_button.cpp:325-358`) without input: `status.hovering`
 * and `status.press_attempt` stay false, so `DRAW_PRESSED` fires exactly when `button_pressed` is true, and `disabled`
 * wins first. Measured with `pnpm ref:godot --mode 2d`: a checked row's label reads (255,255,255),
 * `font_pressed_color`, not the 0.875 grey of `DRAW_NORMAL`.
 */
export type CheckBoxDrawState = 'normal' | 'pressed' | 'disabled';

export function resolveCheckBoxDrawState(props: CheckBoxProperties): CheckBoxDrawState {
  if (props.disabled) return 'disabled';
  if (props.buttonPressed) return 'pressed';
  return 'normal';
}

/** `control_font_color` (`default_theme.cpp:101`), CheckBox's own `font_color` default (`:300`). */
export const CHECKBOX_DEFAULT_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };
/** `control_font_pressed_color = Color(1, 1, 1)` (`:108`), CheckBox's own `font_pressed_color` default (`:301`). */
export const CHECKBOX_DEFAULT_PRESSED_FONT_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };
/** `control_font_disabled_color = control_font_color * Color(1, 1, 1, 0.5)` (`:106`), CheckBox's own `font_disabled_color` default (`:305`). */
export const CHECKBOX_DEFAULT_DISABLED_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 0.5 };

const CHECKBOX_THEME_KEYS: Record<CheckBoxDrawState, TextThemeKeys> = {
  normal: { sizeKey: 'font_size', colorKey: 'font_color' },
  pressed: { sizeKey: 'font_size', colorKey: 'font_pressed_color' },
  disabled: { sizeKey: 'font_size', colorKey: 'font_disabled_color' },
};

/** Resolves CheckBox's theme font size and colour for `state`: overrides, else the ancestor Theme chain, the theme default or CheckBox's own literal. */
export function checkBoxTextTheme(
  n: SolveNode,
  props: CheckBoxProperties,
  state: CheckBoxDrawState,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = {
    fontSizePx: ctx.theme.fontSize,
    color:
      state === 'disabled'
        ? CHECKBOX_DEFAULT_DISABLED_FONT_COLOR
        : state === 'pressed'
          ? CHECKBOX_DEFAULT_PRESSED_FONT_COLOR
          : CHECKBOX_DEFAULT_FONT_COLOR,
  };
  return resolveTextTheme(n, props, CHECKBOX_THEME_KEYS[state], defaults);
}


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
export const CHECKBOX_ICON_NATURAL_SIZE: Vec2 = { x: 16, y: 16 };

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
 * Which of CheckBox's 8 icon slots have a themed answer, for `SolveNode.textureSlots`. The walker
 * has already resolved the names (`SolveNode.icons`), and this turns them into size requests.
 */
export const checkBoxTextureSlots: TextureSlotsFn = (_node, themedIcons = {}) => {
  const requests: TextureSlotRequest[] = [];
  for (const name of CHECK_BOX_ICON_THEME_NAMES) {
    const themed = themedIcons[name];
    if (themed) requests.push({ key: name, ref: themed.ref, scope: themed.resources });
  }
  return requests;
};

/**
 * `CheckBox::get_icon_size` (`check_box.cpp:35-62`): the max over all 8 icons, whichever is showing.
 * A slot no theme touched falls back to the vendored default's size, since the default theme
 * registers all 8 (`default_theme.cpp:288-295`).
 */
export function checkBoxIconNaturalSize(n: Pick<SolveNode, 'textureSlots'>): Vec2 {
  let w = 0;
  let h = 0;
  for (const name of CHECK_BOX_ICON_THEME_NAMES) {
    const size = n.textureSlots[name] ?? CHECKBOX_ICON_NATURAL_SIZE;
    w = Math.max(w, size.x);
    h = Math.max(h, size.y);
  }
  return { x: w, y: h };
}

/** `check_v_offset` theme constant default (`default_theme.cpp:309`). */
const DEFAULT_CHECK_V_OFFSET = 0;

/** `icon_max_width`: CheckBox registers none, so Button's default (`0`, unclamped) applies through the shared `theme_override_constants` key. */
export function checkBoxIconMaxWidth(constants: SolveNode['constants']): number {
  return constants.icon_max_width ?? 0;
}

/** `h_separation`: CheckBox's default (`default_theme.cpp:308`, `round(4*scale)`) equals `theme.separation`. */
export function checkBoxHSeparation(constants: SolveNode['constants'], ctx: Pick<SolveContext, 'theme'>): number {
  return Math.max(0, constants.h_separation ?? ctx.theme.separation);
}

/** `check_v_offset`, a `theme_override_constants` key CheckBox reads directly (`check_box.cpp:133`). */
export function checkBoxCheckVOffset(constants: SolveNode['constants']): number {
  return constants.check_v_offset ?? DEFAULT_CHECK_V_OFFSET;
}


/**
 * `CheckBox::get_minimum_size` (`check_box.cpp:64-79`): Button's text-only floor plus the check
 * icon's width, and its height floors the result. `padding` is `_get_largest_stylebox_size()`,
 * which for CheckBox is `cbx_empty`'s uniform margin on every state, so both axes double
 * `theme.contentMargin`.
 */
export const checkBoxMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as CheckBoxProperties;
  const margin = ctx.theme.contentMargin;

  const text = props.text ?? '';
  const hasText = text.length > 0;
  const state = resolveCheckBoxDrawState(props);
  const { fontSizePx } = checkBoxTextTheme(n, props, state, ctx);
  const fontMetrics = resolveNodeFontMetrics(n, CHECKBOX_THEME_FONT_KEY);
  // `Button::get_minimum_size` (`button.cpp:492`) reads `paragraph->get_size()`, the ceiled
  // extent (`text_paragraph.cpp:601-608`, `text_server_adv.cpp:7524-7537`). The icon and
  // separation are added outside the ceil (`check_box.cpp:63-73`).
  const measured = hasText && ctx.measureText ? ctx.measureText(text, fontSizePx, 0, fontMetrics) : { x: 0, y: 0 };
  const textSize = { x: shapedTextSizeWidthPx(measured.x), y: measured.y };

  const iconSize = fitIconSize(checkBoxIconNaturalSize(n), checkBoxIconMaxWidth(n.constants));
  const hSeparation = checkBoxHSeparation(n.constants, ctx);

  // Godot's guard is `content_size.width > 0 && tex_size.width > 0` (`check_box.cpp:70`): the
  // measured width, not the authored string. An absent measurer makes `textSize.x` 0, and
  // `h_separation` must not appear either.
  const width = 2 * margin + textSize.x + (textSize.x > 0 ? hSeparation : 0) + iconSize.x;
  const height = 2 * margin + Math.max(textSize.y, iconSize.y);

  return { x: width, y: height };
};


export interface CheckBoxContentInput {
  /** The control's own solved rect size, Godot px. */
  rectSize: Vec2;
  /** `cbx_empty`'s uniform content margin, `theme.contentMargin` on all four sides. Every state shares this `StyleBoxEmpty` (`default_theme.cpp:276-277`), so nothing is drawn. */
  margin: number;
  /** The check icon's size, already fitted with `fitIconSize` and rounded. */
  iconSize: Vec2;
  checkVOffset: number;
  hSeparation: number;
  hasText: boolean;
  /** The shaped text's natural (unwrapped) size, ignored when `hasText` is false. */
  textNaturalSize: Vec2;
  /** `Control::is_layout_rtl()` (`SolveNode.rtl`): moves the check to the right edge and the label against it. */
  rtl: boolean;
}

export interface CheckBoxContentLayout {
  /** Local to the control's own top-left, Godot px. */
  iconRect: Rect2;
  /** The text paragraph's box top-left, local Godot px, for `<TextRun>`, which anchors each line at its baseline from there. `null` when there is no text. */
  textOffset: Vec2 | null;
}

/**
 * The icon `ofs` (`check_box.cpp:126-133`) and Button's internal-margin reservation
 * (`button.cpp:247-260,444-456`). The internal margin is always the icon's width
 * (`check_box.cpp:96-101`), never zero, so the gap is always `iconSize.x + h_separation`.
 */
export function layoutCheckBoxContent(input: CheckBoxContentInput): CheckBoxContentLayout {
  const { rectSize, margin, iconSize, checkVOffset, hSeparation, hasText, textNaturalSize, rtl } = input;

  const iconRect: Rect2 = {
    x: Math.floor(rtl ? rectSize.x - margin - iconSize.x : margin),
    y: Math.floor((rectSize.y - iconSize.y) / 2 + checkVOffset),
    w: iconSize.x,
    h: iconSize.y,
  };

  let textOffset: Vec2 | null = null;
  if (hasText) {
    const reserved = iconSize.x + hSeparation;
    const customElementHeight = rectSize.y - 2 * margin;
    const drawableWidth = rectSize.x - 2 * margin - reserved;
    // `rtl` moves the reservation to SIDE_RIGHT (`:98-100`) and the icon to the right margin
    // (`:129`), and the constructor's LEFT alignment (`:174`) swaps to RIGHT (`button.cpp:271-275`).
    const x = rtl
      ? margin + buttonTextAlignShiftPx(textNaturalSize.x, drawableWidth, HORIZONTAL_ALIGNMENT_RIGHT)
      : margin + reserved;
    const y = centredTextTopPx(customElementHeight, textNaturalSize.y, margin);
    textOffset = { x, y };
  }

  return { iconRect, textOffset };
}
