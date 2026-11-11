/**
 * CheckButton's native (WebGL canvas) rect solver and content layout: `get_minimum_size`,
 * `get_icon_size` and `_notification` (`scene/gui/check_button.cpp`) with the theme defaults
 * (`scene/theme/default_theme.cpp:316-353`). `layoutCheckButtonContent` reserves the toggle as Button's
 * `_internal_margin` (`check_button.cpp:96-104`) and `buttonBase.ts` lays the icon and label out beside it.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type {
  MinimumSizeFn,
  SolveContext,
  TextureSlotsFn,
} from '../../../../r3f/controls/native/solverRegistry';
import { themedSlotRequests } from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import {
  BUTTON_ICON_SLOT_KEY,
  BUTTON_THEME_KEYS,
  buttonContentMinimumSize,
  buttonIconSlotRequests,
  fitIconSize,
  internalMarginAt,
  layoutButtonContent,
  resolveToggleDrawState,
  shapedNodeLabel,
  tentativeWrapWidthPx,
  withReservedElementSize,
  type ButtonContentFacts,
  type ButtonContentInput,
  type ButtonContentLayout,
  type ToggleDrawState,
} from '../../../../r3f/controls/native/buttonBase';
import { checkFamilyContentFacts } from '../button/nativeSolver';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
} from '../../../../r3f/controls/native/textTheme';
import type { CheckButtonIcons } from '../../../../r3f/controls/native/themeIcons';
import { CHECK_BUTTON_ICON_NATURAL_SIZE } from '../../../../r3f/controls/native/themeIcons';
import type { CheckButtonProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import type { Rgba } from '../../../../godot/math/math';
import {
  CONTROL_FONT_COLOR,
  CONTROL_FONT_DISABLED_COLOR,
  CONTROL_FONT_PRESSED_COLOR,
} from '../../../../godot/scene/theme';

/** `SceneStringName(font)`, registered under CheckButton's own type (`scene/theme/default_theme.cpp:337`), not inherited from Button's. */
export const CHECKBUTTON_THEME_FONT_KEY = 'font';

/**
 * `BaseButton::get_draw_mode()` (`base_button.cpp:325-358`) without input: `status.hovering` and
 * `status.press_attempt` stay false, so `button_pressed` alone selects pressed, and `disabled` wins.
 */
export function resolveCheckButtonDrawState(props: CheckButtonProperties): ToggleDrawState {
  return resolveToggleDrawState(props.disabled, props.buttonPressed);
}

/** CheckButton's own `font_color` default (`default_theme.cpp:340`). */
const CHECKBUTTON_DEFAULT_FONT_COLOR = CONTROL_FONT_COLOR;
/** CheckButton's own `font_pressed_color` default (`default_theme.cpp:341`). */
const CHECKBUTTON_DEFAULT_PRESSED_FONT_COLOR = CONTROL_FONT_PRESSED_COLOR;
/** CheckButton's own `font_disabled_color` default (`default_theme.cpp:345`). */
const CHECKBUTTON_DEFAULT_DISABLED_FONT_COLOR = CONTROL_FONT_DISABLED_COLOR;

/** Resolves CheckButton's theme font size and colour for `state`: overrides, else the ancestor Theme chain, the theme default or CheckButton's own literal. */
export function checkButtonTextTheme(
  n: SolveNode,
  props: CheckButtonProperties,
  state: ToggleDrawState,
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
  return resolveTextTheme(n, props, BUTTON_THEME_KEYS[state], defaults);
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

/** Button's own `icon` and those of CheckButton's 8 icon slots that have a themed answer, as `checkBoxTextureSlots` does for CheckBox. */
export const checkButtonTextureSlots: TextureSlotsFn = (node, themedIcons = {}) => [
  ...buttonIconSlotRequests(node),
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
export function checkButtonDrawnIconSize(
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

/** `cb_empty`'s Y content margin, `round(4*scale)` (`default_theme.cpp:317`), which equals `theme.contentMargin`. The margin is asymmetric: X is `round(6*scale)`. */
function checkButtonMarginY(ctx: Pick<SolveContext, 'theme'>): number {
  return ctx.theme.contentMargin;
}

/** `cb_empty`'s X content margin, `round(6*scale)` (`default_theme.cpp:317`), from `theme.scale`: `theme.contentMargin` is a different literal. */
function checkButtonMarginX(ctx: Pick<SolveContext, 'theme'>): number {
  return Math.round(6 * ctx.theme.scale);
}

/** `icon_max_width`: `check_button.cpp` binds none, so Button's default (`0`, unclamped) applies through the shared `theme_override_constants` key. */
function checkButtonIconMaxWidth(constants: SolveNode['constants']): number {
  return constants.icon_max_width ?? 0;
}

/** `h_separation`: CheckButton's default (`default_theme.cpp:348`, `round(4*scale)`) equals `theme.separation`. */
function checkButtonHSeparation(constants: SolveNode['constants'], ctx: Pick<SolveContext, 'theme'>): number {
  return Math.max(0, constants.h_separation ?? ctx.theme.separation);
}

/** `check_v_offset`, a `theme_override_constants` key CheckButton reads directly (`check_button.cpp:143`), default `0` (`default_theme.cpp:349`). */
export function checkButtonCheckVOffset(constants: SolveNode['constants']): number {
  return constants.check_v_offset ?? 0;
}

/** The toggle icon of the current draw state at its natural size, fitted to `icon_max_width`. */
export function checkButtonFittedIconSize(
  n: Pick<SolveNode, 'textureSlots' | 'constants' | 'rtl'>,
  isDisabled: boolean
): Vector2 {
  return fitIconSize(checkButtonIconNaturalSize(n, isDisabled, n.rtl), checkButtonIconMaxWidth(n.constants));
}

/**
 * What `layoutButtonContent` reads of a CheckButton at `rectSize`: `cb_empty`'s margins (all states share
 * one `StyleBoxEmpty`, `default_theme.cpp:316-325`), the toggle reserved as the internal margin on the
 * trailing side (`check_button.cpp:96-104`), and Button's own icon.
 */
export function checkButtonContentFacts(
  n: Pick<SolveNode, 'textureSlots' | 'constants' | 'rtl'>,
  props: CheckButtonProperties,
  ctx: Pick<SolveContext, 'theme'>,
  rectSize: Vector2,
  iconNaturalSize: Vector2 | null
): ButtonContentFacts {
  const toggleWidth = checkButtonFittedIconSize(n, props.disabled === true).x;
  return checkFamilyContentFacts({
    n,
    props,
    ctx,
    rectSize,
    iconNaturalSize,
    margin: { x: checkButtonMarginX(ctx), y: checkButtonMarginY(ctx) },
    internalMargin: internalMarginAt(n.rtl ? 'left' : 'right', toggleWidth),
  });
}

/**
 * `CheckButton::get_minimum_size` (`check_button.cpp:64-79`): Button's floor for its text and icon plus the
 * toggle's width, and `h_separation` only between content and toggle. Not `buttonMinimumSize`, whose flat stylebox
 * is Button's: the lookup is keyed by the node's own class, where every state is `cb_empty` (`default_theme.cpp:316-325`).
 */
export const checkButtonMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as CheckButtonProperties;
  const marginX = checkButtonMarginX(ctx);
  const marginY = checkButtonMarginY(ctx);

  const state = resolveCheckButtonDrawState(props);
  const { fontSizePx } = checkButtonTextTheme(n, props, state, ctx);
  const iconNaturalSize = n.textureSlots[BUTTON_ICON_SLOT_KEY] ?? null;
  const factsAt = (rectSize: Vector2) => checkButtonContentFacts(n, props, ctx, rectSize, iconNaturalSize);
  const label = { fontSizePx, themeFontKey: CHECKBUTTON_THEME_FONT_KEY };
  // A wrapping label's rows follow the tentative width (`button.cpp:429-432`).
  const boxWidthPx = tentativeWrapWidthPx(
    props,
    ctx.measureText ? ctx.tentativeRect?.(n) : undefined,
    factsAt,
    () => shapedNodeLabel(n, ctx, props, { ...label, boxWidthPx: 0 })
  );
  // `button.cpp:492` reads `paragraph->get_size()`, the ceiled extent. `clip_text`, a trimming overrun
  // or autowrap zeroes the width (`button.cpp:493-495`). The toggle and separation add outside the ceil.
  const layout = shapedNodeLabel(n, ctx, props, { ...label, boxWidthPx });
  const content = buttonContentMinimumSize(factsAt({ x: 0, y: 0 }), layout, props);
  const { x, y } = withReservedElementSize(
    content,
    checkButtonFittedIconSize(n, state === 'disabled'),
    checkButtonHSeparation(n.constants, ctx)
  );

  return { x: 2 * marginX + x, y: 2 * marginY + y };
};

interface CheckButtonContentInput {
  /** What `layoutButtonContent` reads, the toggle's `internalMargin` included. */
  content: ButtonContentInput;
  /** The toggle's size, already fitted with `fitIconSize`. */
  checkSize: Vector2;
  checkVOffset: number;
}

interface CheckButtonContentLayout extends Pick<ButtonContentLayout, 'icon' | 'labelBox'> {
  /** The toggle's top-left, local to the control's own top-left, Godot px. */
  checkPosition: Vector2;
}

/**
 * The toggle's `ofs` (`check_button.cpp:129-137`) and Button's layout of its icon and label in what the
 * toggle leaves (`button.cpp:247-259`). The internal margin is always the toggle's width
 * (`check_button.cpp:96-104`), on the right, or on the left under RTL, which also moves the toggle to the left margin.
 */
export function layoutCheckButtonContent({
  content,
  checkSize,
  checkVOffset,
}: CheckButtonContentInput): CheckButtonContentLayout {
  const { rectSize, styleMargin, rtl } = content;
  // Unrounded: an odd height leaves the toggle on a half pixel (`check_button.cpp:135-140`).
  const checkPosition: Vector2 = {
    x: rtl ? styleMargin.left : rectSize.x - (checkSize.x + styleMargin.right),
    y: (rectSize.y - checkSize.y) / 2 + checkVOffset,
  };
  const { icon, labelBox } = layoutButtonContent(content);
  return { checkPosition, icon, labelBox };
}
