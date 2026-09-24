/**
 * CheckButton's native (WebGL canvas) rect solver and content layout: `get_minimum_size`,
 * `get_icon_size` and `_notification` (`scene/gui/check_button.cpp`) with the theme defaults
 * (`scene/theme/default_theme.cpp:316-353`). It ports the placement itself: `buttonBase.ts` does not
 * model Button's `_internal_margin` (`Button::_set_internal_margin`, `check_button.cpp:96-104`).
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
  swapAlignmentSide,
  tintColor,
} from '../../../../r3f/controls/native/buttonBase';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import type { CheckButtonIcons } from '../../../../r3f/controls/native/themeIcons';
import { CHECK_BUTTON_ICON_NATURAL_SIZE } from '../../../../r3f/controls/native/themeIcons';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import type { ControlColor } from '../control/types';
import type { CheckButtonProperties } from './types';

/** `SceneStringName(font)`, registered under CheckButton's own type (`scene/theme/default_theme.cpp:337`), not inherited from Button's. */
export const CHECKBUTTON_THEME_FONT_KEY = 'font';

export { fitIconSize, tintColor };


/**
 * `BaseButton::get_draw_mode()` (`base_button.cpp:325-358`) without input: `status.hovering` and
 * `status.press_attempt` stay false, so `button_pressed` alone selects pressed, and `disabled` wins.
 */
export type CheckButtonDrawState = 'normal' | 'pressed' | 'disabled';

export function resolveCheckButtonDrawState(props: CheckButtonProperties): CheckButtonDrawState {
  if (props.disabled) return 'disabled';
  if (props.buttonPressed) return 'pressed';
  return 'normal';
}

/** `control_font_color` (`default_theme.cpp:101`), CheckButton's own `font_color` default (`:340`). */
export const CHECKBUTTON_DEFAULT_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };
/** `control_font_pressed_color = Color(1, 1, 1)` (`:108`), CheckButton's own `font_pressed_color` default (`:341`). */
export const CHECKBUTTON_DEFAULT_PRESSED_FONT_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };
/** `control_font_disabled_color = control_font_color * Color(1, 1, 1, 0.5)` (`:106`), CheckButton's own `font_disabled_color` default (`:345`). */
export const CHECKBUTTON_DEFAULT_DISABLED_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 0.5 };

const CHECKBUTTON_THEME_KEYS: Record<CheckButtonDrawState, TextThemeKeys> = {
  normal: { sizeKey: 'font_size', colorKey: 'font_color' },
  pressed: { sizeKey: 'font_size', colorKey: 'font_pressed_color' },
  disabled: { sizeKey: 'font_size', colorKey: 'font_disabled_color' },
};

/** Resolves CheckButton's theme font size and colour for `state`: overrides, else the ancestor Theme chain, the theme default or CheckButton's own literal. */
export function checkButtonTextTheme(
  n: SolveNode,
  props: CheckButtonProperties,
  state: CheckButtonDrawState,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = {
    fontSizePx: ctx.theme.fontSize,
    color:
      state === 'disabled'
        ? CHECKBUTTON_DEFAULT_DISABLED_FONT_COLOR
        : state === 'pressed'
          ? CHECKBUTTON_DEFAULT_PRESSED_FONT_COLOR
          : CHECKBUTTON_DEFAULT_FONT_COLOR,
  };
  return resolveTextTheme(n, props, CHECKBUTTON_THEME_KEYS[state], defaults);
}


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

/** Which of CheckButton's 8 icon slots have a themed answer, as `checkBoxTextureSlots` does for CheckBox. */
export const checkButtonTextureSlots: TextureSlotsFn = (_node, themedIcons = {}) => {
  const requests: TextureSlotRequest[] = [];
  for (const name of CHECK_BUTTON_ICON_THEME_NAMES) {
    const themed = themedIcons[name];
    if (themed) requests.push({ key: name, ref: themed.ref, scope: themed.resources });
  }
  return requests;
};

/**
 * `CheckButton::get_icon_size` (`check_button.cpp:35-65`): the max over the two icons the current
 * `disabled` state and layout direction select, unlike CheckBox's max over all 8. A slot no theme
 * touched falls back to the vendored default's size.
 */
export function checkButtonIconNaturalSize(
  n: Pick<SolveNode, 'textureSlots'>,
  disabled: boolean,
  rtl: boolean
): Vec2 {
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

/** `button_checked_color` and `button_unchecked_color`, both `Color(1, 1, 1)` (`default_theme.cpp:352-353`) and overridable. Read whatever `disabled` says: the `_disabled` icons carry the dimming (`check_button.cpp:139-141`). */
const CHECKBUTTON_ICON_MODULATE_DEFAULT: ControlColor = { r: 1, g: 1, b: 1, a: 1 };

export function checkButtonIconColor(props: CheckButtonProperties, colors: SolveNode['colors']): ControlColor {
  const key = props.buttonPressed ? 'button_checked_color' : 'button_unchecked_color';
  return colors[key] ?? CHECKBUTTON_ICON_MODULATE_DEFAULT;
}


/** `cb_empty`'s Y content margin, `round(4*scale)` (`default_theme.cpp:317`), which equals `theme.contentMargin`. The margin is asymmetric: X is `round(6*scale)`. */
export function checkButtonMarginY(ctx: Pick<SolveContext, 'theme'>): number {
  return ctx.theme.contentMargin;
}

/** `cb_empty`'s X content margin, `round(6*scale)` (`default_theme.cpp:317`), from `theme.scale`: `theme.contentMargin` is a different literal. */
export function checkButtonMarginX(ctx: Pick<SolveContext, 'theme'>): number {
  return Math.round(6 * ctx.theme.scale);
}

/** `icon_max_width`: `check_button.cpp` binds none, so Button's default (`0`, unclamped) applies through the shared `theme_override_constants` key. */
export function checkButtonIconMaxWidth(constants: SolveNode['constants']): number {
  return constants.icon_max_width ?? 0;
}

/** `h_separation`: CheckButton's default (`default_theme.cpp:348`, `round(4*scale)`) equals `theme.separation`. */
export function checkButtonHSeparation(constants: SolveNode['constants'], ctx: Pick<SolveContext, 'theme'>): number {
  return Math.max(0, constants.h_separation ?? ctx.theme.separation);
}

/** `check_v_offset`, a `theme_override_constants` key CheckButton reads directly (`check_button.cpp:143`), default `0` (`default_theme.cpp:349`). */
export function checkButtonCheckVOffset(constants: SolveNode['constants']): number {
  return constants.check_v_offset ?? 0;
}

/** CheckButton's default text alignment is LEFT (`check_button.cpp:169`), over Button's CENTER. A scene's `alignment` still wins. */
export const CHECKBUTTON_DEFAULT_ALIGNMENT_LEFT = 0;



/**
 * `CheckButton::get_minimum_size` (`check_button.cpp:64-79`): Button's text-only floor plus the icon's
 * width, and `h_separation` only with text. Not `buttonMinimumSize`, whose flat stylebox is Button's:
 * the lookup is keyed by the node's own class, where every state is `cb_empty` (`default_theme.cpp:316-325`).
 * The inherited Button `icon` is not modelled (`comparison.md`).
 */
export const checkButtonMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as CheckButtonProperties;
  const marginX = checkButtonMarginX(ctx);
  const marginY = checkButtonMarginY(ctx);

  const text = props.text ?? '';
  const hasText = text.length > 0;
  const state = resolveCheckButtonDrawState(props);
  const { fontSizePx } = checkButtonTextTheme(n, props, state, ctx);
  const fontMetrics = resolveNodeFontMetrics(n, CHECKBUTTON_THEME_FONT_KEY);
  // `Button::get_minimum_size` (`button.cpp:492`) reads `paragraph->get_size()`, the ceiled
  // extent. The icon and separation are added outside the ceil (`check_button.cpp:66-77`).
  const measured = hasText && ctx.measureText ? ctx.measureText(text, fontSizePx, 0, fontMetrics) : { x: 0, y: 0 };
  const textSize = { x: shapedTextSizeWidthPx(measured.x), y: measured.y };

  const iconSize = fitIconSize(
    checkButtonIconNaturalSize(n, state === 'disabled', n.rtl),
    checkButtonIconMaxWidth(n.constants)
  );
  const hSeparation = checkButtonHSeparation(n.constants, ctx);

  const width = 2 * marginX + textSize.x + (textSize.x > 0 ? hSeparation : 0) + iconSize.x;
  const height = 2 * marginY + Math.max(textSize.y, iconSize.y);

  return { x: width, y: height };
};


export interface CheckButtonContentInput {
  /** The control's own solved rect size, Godot px. */
  rectSize: Vec2;
  marginX: number;
  marginY: number;
  /** The check icon's size, already fitted with `fitIconSize`. */
  iconSize: Vec2;
  checkVOffset: number;
  hSeparation: number;
  hasText: boolean;
  /** Text `alignment` (`HorizontalAlignment`). CheckButton's default is LEFT. */
  textAlignment: number;
  /** The shaped text's natural (unwrapped) size, ignored when `hasText` is false. */
  textNaturalSize: Vec2;
  /** `Control::is_layout_rtl()` (`SolveNode.rtl`): moves the toggle to the left edge and swaps the label's alignment side. */
  rtl: boolean;
}

export interface CheckButtonContentLayout {
  /** Local to the control's own top-left, Godot px. */
  iconRect: Rect2;
  /** The text paragraph's box top-left, local Godot px. `null` when there is no text. */
  textOffset: Vec2 | null;
}

/**
 * The icon `ofs` (`check_button.cpp:129-137`) and Button's internal-margin reservation
 * (`button.cpp:247-260,444-456`): the internal margin is always the icon's width
 * (`check_button.cpp:96-104`), so the gap is always `iconSize.x + h_separation`. `rtl` moves both
 * to the left and swaps the alignment side (`button.cpp:271-275`, `check_button.cpp:174`).
 */
export function layoutCheckButtonContent(input: CheckButtonContentInput): CheckButtonContentLayout {
  const {
    rectSize,
    marginX,
    marginY,
    iconSize,
    checkVOffset,
    hSeparation,
    hasText,
    textAlignment,
    textNaturalSize,
    rtl,
  } = input;

  const iconRect: Rect2 = {
    x: Math.floor(rtl ? marginX : rectSize.x - (iconSize.x + marginX)),
    y: Math.floor((rectSize.y - iconSize.y) / 2 + checkVOffset),
    w: iconSize.x,
    h: iconSize.y,
  };

  let textOffset: Vec2 | null = null;
  if (hasText) {
    const reserved = iconSize.x + hSeparation;
    const textBoxWidth = rectSize.x - 2 * marginX - reserved;
    const customElementHeight = rectSize.y - 2 * marginY;
    const align = rtl ? swapAlignmentSide(textAlignment) : textAlignment;
    const shiftX = buttonTextAlignShiftPx(textNaturalSize.x, textBoxWidth, align);
    const x = marginX + (rtl ? reserved : 0) + shiftX;
    const y = centredTextTopPx(customElementHeight, textNaturalSize.y, marginY);
    textOffset = { x, y };
  }

  return { iconRect, textOffset };
}

