/**
 * CheckBox's native (WebGL canvas) rect solver + draw-state/content-layout
 * math — `CheckBox::get_minimum_size`/`get_icon_size`/`_notification`
 * (`scene/gui/check_box.cpp`) and the theme defaults
 * `scene/theme/default_theme.cpp:274-313` registers under type name
 * `"CheckBox"`. Registered via `controlSolverRegistry.registerMinimumSize`.
 *
 * CheckBox's own "normal" StyleBox (`theme_cache.normal_style`) is a
 * `StyleBoxEmpty` (`default_theme.cpp:276-277`, `cbx_empty`, every draw-state
 * key bound to the SAME instance) — a fixed content margin with NOTHING
 * drawn. So unlike Button this solver never builds/tints a `StyleBoxFlatData`
 * at all: `theme.contentMargin` (already the exact `round(4*scale)` literal
 * `cbx_empty` uses) stands in for it directly, uniformly on all four sides,
 * and `Component.tsx` draws no chrome mesh.
 *
 * CheckBox reserves space for its check icon via Button's OWN
 * `_internal_margin` mechanism (`Button::_set_internal_margin`,
 * `check_box.cpp:96-101`) — `buttonBase.ts`'s `layoutButtonContent`
 * explicitly does not model that (Button itself never triggers it: its doc
 * calls it "an OptionButton/CheckBox concern"),
 * so this module ports the icon+text placement math itself rather than
 * force-fitting CheckBox's fixed icon-beside-text arrangement through
 * Button's generic icon parameter.
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
 * CheckBox's own theme font key — `SceneStringName(font)` = `"font"`,
 * `scene/theme/default_theme.cpp:297`:
 * `theme->set_font(SceneStringName(font), "CheckBox", Ref<Font>());` — its
 * OWN default-theme registration, under CheckBox's own native type, not
 * inherited from Button's (Godot's theme lookup walks native inheritance
 * only when THIS type has no entry of its own — the Theme slice's
 * `buildThemeTypeChain`). Fed to `resolveNodeFontMetrics` by both this module
 * and `Component.tsx` so the two agree on which font this CheckBox is in.
 */
export const CHECKBOX_THEME_FONT_KEY = 'font';

// Re-exported so Component.tsx can build on the shared, Button-generic
// pieces without importing `buttonBase.ts` a second time under a different name.
export { fitIconSize, tintColor };

// --- Draw state --------------------------------------------------------------

/**
 * `BaseButton::get_draw_mode` (`scene/gui/base_button.cpp:325-358`), collapsed
 * to what a pointer-less static preview can ever select: `status.hovering`
 * and `status.press_attempt` are always false (no input), so the function's
 * own `else` branch runs unconditionally and reduces to
 * `pressing = status.pressed` — i.e. Godot's `DRAW_PRESSED` fires exactly
 * when `button_pressed` is true (CheckBox toggles that flag when checked),
 * NOT only while a mouse physically holds it down. `disabled` still wins
 * outright (`DRAW_DISABLED`, checked first in the source).
 *
 * Verified against a `pnpm ref:godot --mode 2d` render of a CheckBox probe scene:
 * the checked (`button_pressed=true`), non-disabled row's label reads pure
 * white (255,255,255) at probe (527,298) — `font_pressed_color`, not the
 * 0.875-gray a merely-`DRAW_NORMAL` label would read.
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

/** Resolves CheckBox's own theme font size/colour for `state` (overrides, else the ancestor Theme chain / theme default / CheckBox's own literal — `resolveTextTheme`'s own doc). */
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

// --- Icon selection ------------------------------------------------------------

export type CheckBoxIconKey = keyof CheckBoxIcons;

/**
 * `CheckBox::_notification`'s `NOTIFICATION_DRAW` (`check_box.cpp:112-131`):
 * `is_radio()` (a valid `button_group`) swaps the whole checked/unchecked
 * pair for the `radio_*` pair; within either pair, `is_disabled()` picks the
 * `_disabled` variant and `is_pressed()` (== `button_pressed`) picks
 * checked vs unchecked. `check_box.cpp` binds no `_mirrored` icon of its own
 * (contrast CheckButton), so layout direction never reaches this choice.
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
 * `CheckBoxIconKey` (this codebase's vendored-table key) → the Theme item
 * name Godot itself registers it under (`BIND_THEME_ITEM(Theme::DATA_TYPE_ICON,
 * CheckBox, <name>)`, `check_box.cpp:157-164`) — the key `SolveNode.icons`/
 * `SolveNode.textureSlots` carry a themed answer under.
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
 * Which of CheckBox's 8 icon slots have a themed answer, for `SolveNode.
 * textureSlots` — `Control::get_theme_icon`'s local-override/ancestor-chain
 * walk was already run by the walker (`SolveNode.icons`); this only turns
 * the names it resolved into texture-size requests.
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
 * `CheckBox::get_icon_size` (`check_box.cpp:35-62`): the MAX over all 8
 * icons' own sizes, whichever draw state is actually showing — every valid
 * `theme_cache` entry contributes, not only the currently-selected one. A
 * name `SolveNode.textureSlots` never resolved (no theme touched it) falls
 * back to the vendored default's own size, since Godot's own default theme
 * registers a valid icon for every one of the 8 (`default_theme.cpp:288-295`).
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

/** `icon_max_width` — CheckBox never registers its own; Button's default (`0`, unclamped) applies via the shared `theme_override_constants` key. */
export function checkBoxIconMaxWidth(constants: SolveNode['constants']): number {
  return constants.icon_max_width ?? 0;
}

/** `h_separation` — CheckBox's own default (`default_theme.cpp:308`, `round(4*scale)`) is numerically `theme.separation`'s own literal. */
export function checkBoxHSeparation(constants: SolveNode['constants'], ctx: Pick<SolveContext, 'theme'>): number {
  return Math.max(0, constants.h_separation ?? ctx.theme.separation);
}

/** `check_v_offset` — a `theme_override_constants` key CheckBox reads directly (`check_box.cpp:133`). */
export function checkBoxCheckVOffset(constants: SolveNode['constants']): number {
  return constants.check_v_offset ?? DEFAULT_CHECK_V_OFFSET;
}

// --- Minimum size --------------------------------------------------------------

/**
 * `CheckBox::get_minimum_size` (`check_box.cpp:64-79`): `Button::get_minimum_size()`
 * text-only floor (CheckBox never sets Button's own `icon` property — the check
 * glyph is a separate concept), then the check icon's width added on top
 * (+ `h_separation`, but ONLY when there IS text — the source's own
 * `if (content_size.width > 0 && tex_size.width > 0)` guard), height floored
 * by the icon's own height. `padding` is `Button::_get_largest_stylebox_size()`,
 * which for CheckBox is `cbx_empty`'s uniform `content_margin_all` on every
 * draw-state key, so both axes use the SAME `theme.contentMargin` doubled
 * rather than a per-state StyleBox lookup.
 */
export const checkBoxMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as CheckBoxProperties;
  const margin = ctx.theme.contentMargin;

  const text = props.text ?? '';
  const hasText = text.length > 0;
  const state = resolveCheckBoxDrawState(props);
  const { fontSizePx } = checkBoxTextTheme(n, props, state, ctx);
  const fontMetrics = resolveNodeFontMetrics(n, CHECKBOX_THEME_FONT_KEY);
  // `Button::get_minimum_size` (`button.cpp:492`) reads `paragraph->get_size()`,
  // the CEILED shaped extent (`text_paragraph.cpp:601-608` ->
  // `text_server_adv.cpp:7524-7537`); CheckBox's icon and separation are added
  // to that whole-pixel width, outside the ceil (`check_box.cpp:63-73`).
  const measured = hasText && ctx.measureText ? ctx.measureText(text, fontSizePx, 0, fontMetrics) : { x: 0, y: 0 };
  const textSize = { x: shapedTextSizeWidthPx(measured.x), y: measured.y };

  const iconSize = fitIconSize(checkBoxIconNaturalSize(n), checkBoxIconMaxWidth(n.constants));
  const hSeparation = checkBoxHSeparation(n.constants, ctx);

  // Godot's own guard is `content_size.width > 0 && tex_size.width > 0`
  // (`check_box.cpp:70`) — gated on the MEASURED text width, not on whether
  // the scene authored a non-empty string: an absent measurer (P11 not yet
  // resolved) makes `textSize.x` 0, and h_separation must not appear either.
  const width = 2 * margin + textSize.x + (textSize.x > 0 ? hSeparation : 0) + iconSize.x;
  const height = 2 * margin + Math.max(textSize.y, iconSize.y);

  return { x: width, y: height };
};

// --- Content layout (icon + text placement) -------------------------------------

export interface CheckBoxContentInput {
  /** The control's own solved rect size, Godot px. */
  rectSize: Vec2;
  /** `cbx_empty`'s uniform content margin (`theme.contentMargin`, all four sides). */
  margin: number;
  /** The check icon's size, ALREADY `fitIconSize`'d + rounded. */
  iconSize: Vec2;
  checkVOffset: number;
  hSeparation: number;
  hasText: boolean;
  /** The shaped text's own natural (unwrapped) size — ignored when `hasText` is false. */
  textNaturalSize: Vec2;
  /** `Control::is_layout_rtl()` (`SolveNode.rtl`) — moves the check to the right edge and the label against it. */
  rtl: boolean;
}

export interface CheckBoxContentLayout {
  /** LOCAL to the control's own top-left, Godot px. */
  iconRect: Rect2;
  /** The text paragraph's own box top-left, LOCAL Godot px — feed straight to `<TextRun>`, which anchors each line at its own baseline from there (`buildGlyphQuadArrays`'s own doc). `null` when there is no text. */
  textOffset: Vec2 | null;
}

/**
 * `CheckBox::_notification`'s icon `ofs` (`check_box.cpp:126-133`) plus
 * Button's OWN internal-margin text reservation
 * (`button.cpp:247-260,444-456`) specialised to CheckBox's fixed
 * icon-then-text arrangement: the internal margin is always the icon's width
 * (`check_box.cpp:96-101`), so the reserved gap between the icon and the text
 * is unconditionally `iconSize.x + h_separation` — Button only skips the
 * `+= h_separation` step when the internal margin itself is zero, which never
 * happens here (the icon always occupies non-zero width).
 *
 * `rtl` moves that reservation from SIDE_LEFT to SIDE_RIGHT (`:98-100`) and
 * the icon to the right content margin (`:129`); the constructor's
 * `HORIZONTAL_ALIGNMENT_LEFT` (`:174`) then swaps to RIGHT
 * (`button.cpp:271-275`), which puts the label at the far end of the
 * narrowed box rather than at its start. Both sides reduce to one reserved
 * strip plus one alignment shift, so they share the arithmetic below.
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
    const x = rtl
      ? margin + buttonTextAlignShiftPx(textNaturalSize.x, drawableWidth, HORIZONTAL_ALIGNMENT_RIGHT)
      : margin + reserved;
    const y = centredTextTopPx(customElementHeight, textNaturalSize.y, margin);
    textOffset = { x, y };
  }

  return { iconRect, textOffset };
}
