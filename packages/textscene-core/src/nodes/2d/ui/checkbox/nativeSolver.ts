/**
 * CheckBox's native (WebGL canvas) rect solver and content layout: `get_minimum_size`, `get_icon_size`
 * and `_notification` (`scene/gui/check_box.cpp`) with the theme defaults
 * (`scene/theme/default_theme.cpp:274-313`). `layoutCheckBoxContent` reserves the check as Button's
 * `_internal_margin` (`check_box.cpp:96-101`) and `buttonBase.ts` lays the icon and label out beside it.
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
import { derivedButtonContentFacts } from '../button/nativeSolver';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
} from '../../../../r3f/controls/native/textTheme';
import type { CheckBoxIcons } from '../../../../r3f/controls/native/themeIcons';
import type { CheckBoxProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import {
  CONTROL_FONT_COLOR,
  CONTROL_FONT_DISABLED_COLOR,
  CONTROL_FONT_PRESSED_COLOR,
} from '../../../../godot/scene/theme';

/**
 * CheckBox's theme font key, `SceneStringName(font)`, registered under CheckBox's own type
 * (`scene/theme/default_theme.cpp:297`), so the lookup never walks to Button's. This module
 * and `Component.tsx` both pass it to `resolveNodeFontMetrics`, so they agree on the font.
 */
export const CHECKBOX_THEME_FONT_KEY = 'font';

/**
 * `BaseButton::get_draw_mode` (`scene/gui/base_button.cpp:325-358`) without input: `status.hovering`
 * and `status.press_attempt` stay false, so `DRAW_PRESSED` fires exactly when `button_pressed` is true, and `disabled`
 * wins first. Measured with `pnpm ref:godot --mode 2d`: a checked row's label reads (255,255,255),
 * `font_pressed_color`, not the `control_font_color` grey of `DRAW_NORMAL`.
 */
export function resolveCheckBoxDrawState(props: CheckBoxProperties): ToggleDrawState {
  return resolveToggleDrawState(props.disabled, props.buttonPressed);
}

/** CheckBox's own `font_color` default (`default_theme.cpp:300`). */
const CHECKBOX_DEFAULT_FONT_COLOR = CONTROL_FONT_COLOR;
/** CheckBox's own `font_pressed_color` default (`default_theme.cpp:301`). */
const CHECKBOX_DEFAULT_PRESSED_FONT_COLOR = CONTROL_FONT_PRESSED_COLOR;
/** CheckBox's own `font_disabled_color` default (`default_theme.cpp:305`). */
const CHECKBOX_DEFAULT_DISABLED_FONT_COLOR = CONTROL_FONT_DISABLED_COLOR;

/** Resolves CheckBox's theme font size and colour for `state`: overrides, else the ancestor Theme chain, the theme default or CheckBox's own literal. */
export function checkBoxTextTheme(
  n: SolveNode,
  props: CheckBoxProperties,
  state: ToggleDrawState,
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
  return resolveTextTheme(n, props, BUTTON_THEME_KEYS[state], defaults);
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
 * Button's own `icon` and those of CheckBox's 8 icon slots that have a themed answer, for
 * `SolveNode.textureSlots`. The walker has already resolved the names (`SolveNode.icons`), and this
 * turns them into size requests.
 */
export const checkBoxTextureSlots: TextureSlotsFn = (node, themedIcons = {}) => [
  ...buttonIconSlotRequests(node),
  ...themedSlotRequests(CHECK_BOX_ICON_THEME_NAMES, themedIcons),
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
export function checkBoxDrawnIconSize(
  n: Pick<SolveNode, 'textureSlots' | 'constants'>,
  key: CheckBoxIconKey
): Vector2 {
  const own = n.textureSlots[CHECK_BOX_ICON_THEME_NAME[key]] ?? CHECKBOX_ICON_NATURAL_SIZE;
  return fitIconSize(own, checkBoxIconMaxWidth(n.constants));
}

/** `check_v_offset` theme constant default (`default_theme.cpp:309`). */
const DEFAULT_CHECK_V_OFFSET = 0;

/** `icon_max_width`: CheckBox registers none, so Button's default (`0`, unclamped) applies through the shared `theme_override_constants` key. */
function checkBoxIconMaxWidth(constants: SolveNode['constants']): number {
  return constants.icon_max_width ?? 0;
}

/** `h_separation`: CheckBox's default (`default_theme.cpp:308`, `round(4*scale)`) equals `theme.separation`. */
function checkBoxHSeparation(constants: SolveNode['constants'], ctx: Pick<SolveContext, 'theme'>): number {
  return Math.max(0, constants.h_separation ?? ctx.theme.separation);
}

/** `check_v_offset`, a `theme_override_constants` key CheckBox reads directly (`check_box.cpp:137`). */
export function checkBoxCheckVOffset(constants: SolveNode['constants']): number {
  return constants.check_v_offset ?? DEFAULT_CHECK_V_OFFSET;
}

/** The check icon at its natural size, fitted to `icon_max_width`. */
export function checkBoxFittedIconSize(n: Pick<SolveNode, 'textureSlots' | 'constants'>): Vector2 {
  return fitIconSize(checkBoxIconNaturalSize(n), checkBoxIconMaxWidth(n.constants));
}

/**
 * What `layoutButtonContent` reads of a CheckBox at `rectSize`: `cbx_empty`'s margin on every side (all
 * states share one `StyleBoxEmpty`, `default_theme.cpp:276-277`), the check reserved as the internal
 * margin on the leading side (`check_box.cpp:96-101`), and Button's own icon.
 */
export function checkBoxContentFacts(
  n: Pick<SolveNode, 'textureSlots' | 'constants' | 'rtl'>,
  props: CheckBoxProperties,
  ctx: Pick<SolveContext, 'theme'>,
  rectSize: Vector2,
  iconNaturalSize: Vector2 | null
): ButtonContentFacts {
  const margin = ctx.theme.contentMargin;
  return derivedButtonContentFacts({
    n,
    props,
    text: props.text ?? '',
    ctx,
    rectSize,
    iconNaturalSize,
    styleMargin: { left: margin, top: margin, right: margin, bottom: margin },
    internalMargin: internalMarginAt(n.rtl ? 'right' : 'left', checkBoxFittedIconSize(n).x),
  });
}

/**
 * `CheckBox::get_minimum_size` (`check_box.cpp:64-79`): Button's floor for its text and icon plus the check's
 * width, and its height floors the result. `padding` is `_get_largest_stylebox_size()`, which for CheckBox
 * is `cbx_empty`'s uniform margin on every state, so both axes double `theme.contentMargin`.
 */
export const checkBoxMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as CheckBoxProperties;
  const margin = ctx.theme.contentMargin;

  const state = resolveCheckBoxDrawState(props);
  const { fontSizePx } = checkBoxTextTheme(n, props, state, ctx);
  const iconNaturalSize = n.textureSlots[BUTTON_ICON_SLOT_KEY] ?? null;
  const factsAt = (rectSize: Vector2) => checkBoxContentFacts(n, props, ctx, rectSize, iconNaturalSize);
  const label = { fontSizePx, themeFontKey: CHECKBOX_THEME_FONT_KEY };
  // A wrapping label's rows follow the tentative width (`button.cpp:429-432`).
  const boxWidthPx = tentativeWrapWidthPx(
    props,
    ctx.measureText ? ctx.tentativeRect?.(n) : undefined,
    factsAt,
    () => shapedNodeLabel(n, ctx, props, { ...label, boxWidthPx: 0 })
  );
  // `button.cpp:492` reads `paragraph->get_size()`, the ceiled extent (`text_paragraph.cpp:601-608`).
  // `clip_text`, a trimming overrun or autowrap zeroes the width (`button.cpp:493-495`). Button's
  // content gets the check and its separation outside the ceil (`check_box.cpp:64-79`).
  const layout = shapedNodeLabel(n, ctx, props, { ...label, boxWidthPx });
  const content = buttonContentMinimumSize(factsAt({ x: 0, y: 0 }), layout, props);
  const { x, y } = withReservedElementSize(
    content,
    checkBoxFittedIconSize(n),
    checkBoxHSeparation(n.constants, ctx)
  );

  return { x: 2 * margin + x, y: 2 * margin + y };
};

interface CheckBoxContentInput {
  /** What `layoutButtonContent` reads, the check's `internalMargin` included. */
  content: ButtonContentInput;
  /** The check's size, already fitted with `fitIconSize`. */
  checkSize: Vector2;
  checkVOffset: number;
}

interface CheckBoxContentLayout extends Pick<ButtonContentLayout, 'icon' | 'labelBox'> {
  /** The check's top-left, local to the control's own top-left, Godot px. */
  checkPosition: Vector2;
}

/**
 * The check's `ofs` (`check_box.cpp:126-133`) and Button's layout of its icon and label in what the check
 * leaves (`button.cpp:247-259`). The internal margin is always the check's width (`check_box.cpp:96-101`),
 * on the left, or on the right under RTL, which also moves the check to the right margin (`:129`).
 */
export function layoutCheckBoxContent({
  content,
  checkSize,
  checkVOffset,
}: CheckBoxContentInput): CheckBoxContentLayout {
  const { rectSize, styleMargin, rtl } = content;
  // `int()` truncates the centring before the offset is added (`check_box.cpp:131-137`).
  const checkPosition: Vector2 = {
    x: rtl ? rectSize.x - styleMargin.right - checkSize.x : styleMargin.left,
    y: Math.trunc((rectSize.y - checkSize.y) / 2) + checkVOffset,
  };
  const { icon, labelBox } = layoutButtonContent(content);
  return { checkPosition, icon, labelBox };
}
