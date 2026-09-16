/**
 * CheckButton's native (WebGL canvas) rect solver + draw-state/content-layout
 * math — `CheckButton::get_minimum_size`/`get_icon_size`/`_notification`
 * (`scene/gui/check_button.cpp`) and the theme defaults
 * `scene/theme/default_theme.cpp:316-353` registers under type name
 * `"CheckButton"`. Registered via `controlSolverRegistry.registerMinimumSize`.
 *
 * CheckButton's own "normal"/"pressed"/"disabled"/"hover"/"hover_pressed"
 * StyleBoxes are ALL the SAME `StyleBoxEmpty` instance, `cb_empty`
 * (`default_theme.cpp:316-325`) — a fixed, ASYMMETRIC content margin
 * (`content_margin_individual(round(6*scale), round(4*scale), round(6*scale),
 * round(4*scale))`, left/right vs top/bottom) with nothing drawn. So this
 * solver never builds/tints a `StyleBoxFlatData` at all, and never calls
 * `button/nativeSolver.ts`'s `buttonMinimumSize` — that function resolves
 * `theme.widgets.button`'s FLAT fill stylebox unconditionally, which is
 * Button's own theme entry, not CheckButton's (`Theme` lookup is keyed by
 * the node's OWN class name, `"CheckButton"`, which the default theme
 * registers cb_empty under directly — Button's entry is never reached).
 * `Component.tsx` draws no chrome mesh either, matching `StyleBoxEmpty`.
 *
 * `cb_empty`'s X margin is `round(6*scale)`, computed here directly off
 * `theme.scale` (`ScaledGodotTheme.scale`) rather than off `theme.contentMargin`
 * (`round(4*scale)`, a different literal that only coincides with `cb_empty`'s
 * Y margin).
 *
 * CheckButton reserves space for its check icon via Button's OWN
 * `_internal_margin` mechanism (`Button::_set_internal_margin`,
 * `check_button.cpp:96-103`, RTL omitted) — `buttonBase.ts`'s
 * `layoutButtonContent` explicitly does not model that, so this module ports
 * the icon+text placement math itself, mirroring `checkbox/nativeSolver.ts`'s
 * `layoutCheckBoxContent` with the icon moved to the RIGHT edge.
 *
 * Pure data + functions, no THREE/React — painting is `Component.tsx`'s job.
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
import { centredTextTopPx, fitIconSize, tintColor } from '../../../../r3f/controls/native/buttonBase';
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

/** `SceneStringName(font)` = `"font"`, `scene/theme/default_theme.cpp:337`: `theme->set_font(SceneStringName(font), "CheckButton", Ref<Font>());` — its own registration, not inherited from Button's. */
export const CHECKBUTTON_THEME_FONT_KEY = 'font';

export { fitIconSize, tintColor };

// --- Draw state --------------------------------------------------------------

/**
 * `BaseButton::get_draw_mode()` (`base_button.cpp:325-358`) collapsed to what
 * a pointer-less static preview can ever select — `status.hovering` and
 * `status.press_attempt` are always false, so `pressing = status.pressed`
 * (i.e. `button_pressed`) unconditionally, and `disabled` wins outright. The
 * same collapse `checkbox/nativeSolver.ts`'s `resolveCheckBoxDrawState`
 * documents at length.
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

/** Resolves CheckButton's own theme font size/colour for `state` (overrides, else the ancestor Theme chain / theme default / CheckButton's own literal — `resolveTextTheme`'s own doc). */
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

// --- Icon selection + modulate ------------------------------------------------

export type CheckButtonIconKey = keyof CheckButtonIcons;

/**
 * `CheckButton::_notification`'s `NOTIFICATION_DRAW` (`check_button.cpp:112-142`,
 * RTL mirrored variants omitted): `is_disabled()` picks the `_disabled`
 * variant, `is_pressed()` (== `button_pressed`) picks the checked ("on") vs
 * unchecked ("off") icon.
 */
export function resolveCheckButtonIconKey(props: CheckButtonProperties): CheckButtonIconKey {
  const disabled = props.disabled === true;
  const checked = props.buttonPressed === true;
  if (checked) return disabled ? 'checkedDisabled' : 'checked';
  return disabled ? 'uncheckedDisabled' : 'unchecked';
}

/** `CheckButtonIconKey` → the Theme item name Godot registers it under (`BIND_THEME_ITEM(Theme::DATA_TYPE_ICON, CheckButton, <name>)`, `check_button.cpp:156-159`). RTL-mirrored variants are out of scope repo-wide, so only these four are themeable here. */
export const CHECK_BUTTON_ICON_THEME_NAME: Record<CheckButtonIconKey, string> = {
  checked: 'checked',
  unchecked: 'unchecked',
  checkedDisabled: 'checked_disabled',
  uncheckedDisabled: 'unchecked_disabled',
};

const CHECK_BUTTON_ICON_THEME_NAMES = Object.values(CHECK_BUTTON_ICON_THEME_NAME);

/** Which of CheckButton's 4 icon slots have a themed answer — mirrors `checkbox/nativeSolver.ts`'s `checkBoxTextureSlots`. */
export const checkButtonTextureSlots: TextureSlotsFn = (_node, themedIcons = {}) => {
  const requests: TextureSlotRequest[] = [];
  for (const name of CHECK_BUTTON_ICON_THEME_NAMES) {
    const themed = themedIcons[name];
    if (themed) requests.push({ key: name, ref: themed.ref, scope: themed.resources });
  }
  return requests;
};

/**
 * `CheckButton::get_icon_size` (`check_button.cpp:35-62`), RTL omitted: the
 * MAX over exactly the two icons the CURRENT `disabled` state selects
 * (`checked`/`unchecked`, or `checked_disabled`/`unchecked_disabled`) —
 * unlike CheckBox, which maxes over all 8 regardless of state, CheckButton's
 * own source only ever reads the pair it is about to draw. A name
 * `SolveNode.textureSlots` never resolved falls back to the vendored
 * default's own size, same reasoning as `checkbox/nativeSolver.ts`'s
 * `checkBoxIconNaturalSize`.
 */
export function checkButtonIconNaturalSize(n: Pick<SolveNode, 'textureSlots'>, disabled: boolean): Vec2 {
  const names: readonly CheckButtonIconKey[] = disabled
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

/** `button_checked_color`/`button_unchecked_color` — both `Color(1, 1, 1)` (`default_theme.cpp:352-353`), bindable via `theme_override_colors`, read regardless of `disabled` (the dimming is baked into the `_disabled` icon variants themselves, `check_button.cpp:139-141`). */
const CHECKBUTTON_ICON_MODULATE_DEFAULT: ControlColor = { r: 1, g: 1, b: 1, a: 1 };

export function checkButtonIconColor(props: CheckButtonProperties, colors: SolveNode['colors']): ControlColor {
  const key = props.buttonPressed ? 'button_checked_color' : 'button_unchecked_color';
  return colors[key] ?? CHECKBUTTON_ICON_MODULATE_DEFAULT;
}

// --- Theme constants -----------------------------------------------------------

/** `cb_empty`'s Y content margin, `round(4*scale)` (`default_theme.cpp:317`) — numerically `theme.contentMargin`'s own literal (Button's margin uses the same base constant). */
export function checkButtonMarginY(ctx: Pick<SolveContext, 'theme'>): number {
  return ctx.theme.contentMargin;
}

/** `cb_empty`'s X content margin, `round(6*scale)` (`default_theme.cpp:317`). */
export function checkButtonMarginX(ctx: Pick<SolveContext, 'theme'>): number {
  return Math.round(6 * ctx.theme.scale);
}

/** `icon_max_width` — CheckButton never registers its own; Button's default (`0`, unclamped) applies via the shared `theme_override_constants` key (`check_button.cpp` binds no `icon_max_width` of its own; Button's `_bind_methods` does). */
export function checkButtonIconMaxWidth(constants: SolveNode['constants']): number {
  return constants.icon_max_width ?? 0;
}

/** `h_separation` — CheckButton's own default (`default_theme.cpp:348`, `round(4*scale)`) is numerically `theme.separation`'s own literal. */
export function checkButtonHSeparation(constants: SolveNode['constants'], ctx: Pick<SolveContext, 'theme'>): number {
  return Math.max(0, constants.h_separation ?? ctx.theme.separation);
}

/** `check_v_offset` — a `theme_override_constants` key CheckButton reads directly (`check_button.cpp:143`), default `0` (`default_theme.cpp:349`). */
export function checkButtonCheckVOffset(constants: SolveNode['constants']): number {
  return constants.check_v_offset ?? 0;
}

/** CheckButton's own default text alignment is LEFT (`CheckButton::CheckButton()`, `check_button.cpp:169`: `set_text_alignment(HORIZONTAL_ALIGNMENT_LEFT)`), overriding Button's CENTER default — a scene's own `alignment` override still wins. */
export const CHECKBUTTON_DEFAULT_ALIGNMENT_LEFT = 0;
const ALIGNMENT_CENTER = 1;
const ALIGNMENT_RIGHT = 2;

// --- Minimum size --------------------------------------------------------------

/**
 * `CheckButton::get_minimum_size` (`check_button.cpp:64-79`): `Button::
 * get_minimum_size()` text-only floor — evaluated against CheckButton's OWN
 * resolved theme (`cb_empty`, this module's own margins), not Button's flat
 * stylebox, since Godot's theme lookup is keyed by the node's actual class.
 * Button's OWN `icon` property (inherited, distinct from the check glyph) is
 * not modelled — see this slice's `comparison.md`. The check icon's width is
 * then added on top (+ `h_separation`, ONLY when there IS text — the
 * source's own `if (content_size.width > 0 && tex_size.width > 0)` guard),
 * height floored by the icon's own height.
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
  // `Button::get_minimum_size` (`button.cpp:492`) reads `paragraph->get_size()`,
  // the CEILED shaped extent; the icon and separation are added to that
  // whole-pixel width, outside the ceil (`check_button.cpp:66-77`).
  const measured = hasText && ctx.measureText ? ctx.measureText(text, fontSizePx, 0, fontMetrics) : { x: 0, y: 0 };
  const textSize = { x: shapedTextSizeWidthPx(measured.x), y: measured.y };

  const iconSize = fitIconSize(checkButtonIconNaturalSize(n, state === 'disabled'), checkButtonIconMaxWidth(n.constants));
  const hSeparation = checkButtonHSeparation(n.constants, ctx);

  const width = 2 * marginX + textSize.x + (textSize.x > 0 ? hSeparation : 0) + iconSize.x;
  const height = 2 * marginY + Math.max(textSize.y, iconSize.y);

  return { x: width, y: height };
};

// --- Content layout (icon + text placement) -------------------------------------

export interface CheckButtonContentInput {
  /** The control's own solved rect size, Godot px. */
  rectSize: Vec2;
  marginX: number;
  marginY: number;
  /** The check icon's size, ALREADY `fitIconSize`'d. */
  iconSize: Vec2;
  checkVOffset: number;
  hSeparation: number;
  hasText: boolean;
  /** Text `alignment` (`HorizontalAlignment`); CheckButton's own default is LEFT. */
  textAlignment: number;
  /** The shaped text's own natural (unwrapped) size — ignored when `hasText` is false. */
  textNaturalSize: Vec2;
}

export interface CheckButtonContentLayout {
  /** LOCAL to the control's own top-left, Godot px. */
  iconRect: Rect2;
  /** The text paragraph's own box top-left, LOCAL Godot px. `null` when there is no text. */
  textOffset: Vec2 | null;
}

/**
 * `CheckButton::_notification`'s icon `ofs` (`check_button.cpp:126-133`, RTL
 * omitted) plus Button's OWN internal-margin text reservation
 * (`button.cpp:247-260,444-456`) specialised to CheckButton's fixed
 * right-icon arrangement: `_internal_margin[SIDE_RIGHT]` is always the
 * icon's width (`check_button.cpp:96-103`), so the reserved gap ahead of the
 * text is unconditionally `iconSize.x + h_separation` on the RIGHT, mirroring
 * `checkbox/nativeSolver.ts`'s `layoutCheckBoxContent` (LEFT icon) about the
 * control's own vertical axis.
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
  } = input;

  const iconRect: Rect2 = {
    x: Math.floor(rectSize.x - (iconSize.x + marginX)),
    y: Math.floor((rectSize.y - iconSize.y) / 2 + checkVOffset),
    w: iconSize.x,
    h: iconSize.y,
  };

  let textOffset: Vec2 | null = null;
  if (hasText) {
    const rightReserved = iconSize.x + hSeparation;
    const textBoxWidth = rectSize.x - marginX - rightReserved - marginX;
    const customElementHeight = rectSize.y - 2 * marginY;
    let shiftX: number;
    switch (textAlignment) {
      case ALIGNMENT_CENTER:
        shiftX = (textBoxWidth - textNaturalSize.x) / 2;
        break;
      case ALIGNMENT_RIGHT:
        shiftX = textBoxWidth - textNaturalSize.x;
        break;
      default:
        shiftX = 0;
        break;
    }
    const x = marginX + shiftX;
    const y = centredTextTopPx(customElementHeight, textNaturalSize.y, marginY);
    textOffset = { x, y };
  }

  return { iconRect, textOffset };
}
