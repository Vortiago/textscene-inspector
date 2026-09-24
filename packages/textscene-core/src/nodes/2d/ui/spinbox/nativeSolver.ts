/**
 * SpinBox's native rect solver: `SpinBox::get_minimum_size` (`scene/gui/spin_box.cpp:82-86`),
 * `_compute_sizes`/`_get_widest_button_icon_width` (`:382-427`), `_update_text` (`:88-114`) and
 * `_update_buttons_state_for_current_value` (`:635-645`). `Component.tsx` paints.
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
import { getFontLinePitchPx } from '../../../../r3f/controls/native/text/fontMetrics';
import type { FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import { peekSceneFontMetrics } from '../../../../r3f/controls/native/text/sceneFontLoader';
import {
  resolveThemeFontIn,
  resolveThemeFontSizeIn,
  themeResolutionScope,
  type ThemeResolutionScope,
} from '../../../../resources/styles/theme/lookup';
import { LINE_EDIT_MINIMUM_CHARACTER_WIDTH } from '../../../../r3f/controls/godotDefaultTheme';
import { contentMarginSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  pickLineEditStyleBox,
  LINE_EDIT_DEFAULT_FONT_COLOR,
  LINE_EDIT_DEFAULT_UNEDITABLE_COLOR,
} from '../lineedit/nativeSolver';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { ControlColor } from '../control/types';
import type { SpinBoxProperties } from './types';

/** `Range`'s default `step` (`scene/gui/range.h:42`). SpinBox's constructor never calls `set_step` (`spin_box.cpp:723-740`), so this is what an unauthored `step` resolves to. */
export const SPIN_BOX_STEP_DEFAULT = 1;

/**
 * `default_theme.cpp:647-648` sets `buttons_width`/`field_and_buttons_separation` as bare
 * literals, unlike the scaled ItemList neighbours at `default_theme.cpp:946-949`, so Godot
 * never multiplies either by `default_theme_scale`.
 */
const SPIN_BOX_BUTTONS_WIDTH = 16;
const SPIN_BOX_FIELD_BUTTONS_SEPARATION = 2;
/**
 * `value_up.svg`/`value_down.svg` (`scene/theme/icons/`) declare `width="16" height="8"`.
 * Vendored icons are never rescaled by the project theme scale (`CHECKBOX_ICON_NATURAL_SIZE`
 * in `checkbox/nativeSolver.ts`).
 */
export const SPIN_BOX_ARROW_ICON_SIZE: Vec2 = { x: 16, y: 8 };

/** `up`/`down`: `BIND_THEME_ITEM_CUSTOM(Theme::DATA_TYPE_ICON, SpinBox, up_icon, "up")` (and `down`, `spin_box.cpp:690,694`). The hover, pressed and disabled variants and the deprecated `updown` are never drawn, as in `Component.tsx`. */
export type SpinBoxIconName = 'up' | 'down';
const SPIN_BOX_ICON_NAMES: readonly SpinBoxIconName[] = ['up', 'down'];

/** Which of `up`/`down` have a themed answer, for `SolveNode.textureSlots`. */
export const spinBoxTextureSlots: TextureSlotsFn = (_node, themedIcons = {}) => {
  const requests: TextureSlotRequest[] = [];
  for (const name of SPIN_BOX_ICON_NAMES) {
    const themed = themedIcons[name];
    if (themed) requests.push({ key: name, ref: themed.ref, scope: themed.resources });
  }
  return requests;
};

/** This icon's resolved size: themed if `SolveNode.textureSlots` resolved it, else the vendored default. */
export function spinBoxIconSize(n: Pick<SolveNode, 'textureSlots'>, name: SpinBoxIconName): Vec2 {
  return n.textureSlots[name] ?? SPIN_BOX_ARROW_ICON_SIZE;
}

/** `SpinBox::_get_widest_button_icon_width` (`spin_box.cpp:411-424`) over `up`/`down`, the icons this codebase draws. */
export function spinBoxWidestButtonIconWidth(n: Pick<SolveNode, 'textureSlots'>): number {
  return Math.max(spinBoxIconSize(n, 'up').x, spinBoxIconSize(n, 'down').x);
}

/**
 * `SpinBox::_compute_sizes` (`spin_box.cpp:382-397`) with the default theme's
 * `set_min_buttons_width_from_icons = 1`, since a SpinBox's per-node theme-constant overrides are
 * not modelled. `widestIconWidth` is `spinBoxWidestButtonIconWidth`'s.
 */
export function spinBoxButtonsBlockWidth(widestIconWidth: number): number {
  const separation = SPIN_BOX_FIELD_BUTTONS_SEPARATION;
  const wanted = SPIN_BOX_BUTTONS_WIDTH + separation;
  const iconEnforced = widestIconWidth + separation;
  return Math.max(wanted, iconEnforced);
}

/** `field_and_buttons_separation` (`default_theme.cpp:647`): the gap between the buttons block and the narrower buttons (`sizing_cache.buttons_width = w - theme_cache.field_and_buttons_separation`, `spin_box.cpp:401`). */
export function spinBoxFieldButtonsSeparation(): number {
  return SPIN_BOX_FIELD_BUTTONS_SEPARATION;
}

/** `buttons_vertical_separation`: `default_theme.cpp:646` sets it to 0, and no per-node theme-constant override is modelled. */
const SPIN_BOX_BUTTONS_VERTICAL_SEPARATION = 0;

export interface SpinBoxLayout {
  /** The internal field's rect: `line_edit`'s full-rect preset with a right offset of `-buttons_block_width` (`spin_box.cpp:394-395`). */
  fieldRect: Rect2;
  /** The up (increment) button's own rect. */
  upRect: Rect2;
  /** The down (decrement) button's own rect. */
  downRect: Rect2;
  /** `field_and_buttons_separator`'s rect (`spin_box.cpp:409-410,482`), the full-height gap between the field and the buttons block. `up_down_buttons_separator` is not exposed: its height is `SPIN_BOX_BUTTONS_VERTICAL_SEPARATION` (0), so it has zero area. */
  fieldAndButtonsSeparatorRect: Rect2;
}

/**
 * `SpinBox::_compute_sizes`'s per-draw geometry (`spin_box.cpp:399-410`). `Size2i size =
 * get_size();` truncates toward zero, so `rectSize` is truncated once. `rtl` (`SolveNode.rtl`)
 * puts the buttons block at x 0 and the separator directly after it (`:403,409`).
 */
export function spinBoxLayout(rectSize: Vec2, widestIconWidth: number, rtl = false): SpinBoxLayout {
  const w = Math.trunc(rectSize.x);
  const h = Math.trunc(rectSize.y);
  const blockWidth = spinBoxButtonsBlockWidth(widestIconWidth);
  const buttonsWidth = blockWidth - spinBoxFieldButtonsSeparation();
  const buttonsLeft = rtl ? 0 : w - buttonsWidth;
  const vSep = Math.min(Math.max(SPIN_BOX_BUTTONS_VERTICAL_SEPARATION, 0), h);
  const buttonUpHeight = Math.trunc((h - vSep) / 2);
  const buttonDownHeight = h - buttonUpHeight - vSep;
  const secondButtonTop = h - buttonDownHeight;

  const fieldWidth = Math.max(0, w - blockWidth);
  // The field has no RTL branch: it is the `LineEdit`'s full-rect preset at offsets
  // `[0, -buttons_block_width]` (`:394-395`), and its `Control::_size_changed` mirror
  // (`control.cpp:1785-1787`) moves it to `parent_width - x - w`.
  const fieldLeft = rtl ? w - fieldWidth : 0;
  const separatorLeft = rtl ? buttonsWidth : fieldWidth;

  return {
    fieldRect: { x: fieldLeft, y: 0, w: fieldWidth, h },
    upRect: { x: buttonsLeft, y: 0, w: buttonsWidth, h: buttonUpHeight },
    downRect: { x: buttonsLeft, y: secondButtonTop, w: buttonsWidth, h: buttonDownHeight },
    fieldAndButtonsSeparatorRect: { x: separatorLeft, y: 0, w: spinBoxFieldButtonsSeparation(), h },
  };
}

/**
 * `Math::step_decimals` (`core/math/math_funcs.cpp:61-85`): how many decimal digits `step`'s
 * fractional part needs, capped at 9 (the table has 10 entries, index 0..9).
 */
const STEP_DECIMALS_THRESHOLDS: readonly number[] = [
  0.9999, 0.09999, 0.009999, 0.0009999, 0.00009999, 0.000009999, 0.0000009999, 0.00000009999, 0.000000009999,
];

function stepDecimals(step: number): number {
  const abs = Math.abs(step);
  const decs = abs - Math.trunc(abs);
  for (let i = 0; i < STEP_DECIMALS_THRESHOLDS.length; i++) {
    if (decs >= STEP_DECIMALS_THRESHOLDS[i]!) return i;
  }
  return 0;
}

/** `Math::range_step_decimals` (`core/math/math_funcs.cpp:89-94`): `step < 1e-13` (an unset or zero step) leaves `String::num`'s digits unlimited. */
export function rangeStepDecimals(step: number): number {
  if (step < 0.0000000000001) return 16;
  return stepDecimals(step);
}

/**
 * `String::num(value, decimals)` (`core/string/ustring.cpp:1405-1481`) for `decimals >= 0`, the
 * only case `range_step_decimals` feeds it. The `nan`/`inf` arms are not ported:
 * `Range::_calc_value` makes neither from finite inputs. Trims trailing
 * zeroes but keeps one digit after the point once any were printed (`ustring.cpp:1467-1481`).
 */
export function formatGodotNumber(value: number, decimals: number): string {
  const fixed = value.toFixed(Math.min(decimals, 32));
  if (!fixed.includes('.')) return fixed;
  let trimmed = fixed.replace(/0+$/, '');
  if (trimmed.endsWith('.')) trimmed += '0';
  return trimmed;
}

/**
 * `SpinBox::_update_text` (`spin_box.cpp:88-114`) for a still frame: `line_edit->is_editing()` is
 * always false, so the prefix and suffix always apply. `accepted` stays `true` without a live
 * edit, so the `update_on_text_changed` re-format never runs.
 */
export function spinBoxDisplayText(props: SpinBoxProperties, resolvedValue: number): string {
  const step = props.step ?? SPIN_BOX_STEP_DEFAULT;
  let text = formatGodotNumber(resolvedValue, rangeStepDecimals(step));
  const prefix = props.prefix ?? '';
  const suffix = props.suffix ?? '';
  if (prefix !== '') text = `${prefix} ${text}`;
  if (suffix !== '') text = `${text} ${suffix}`;
  return text;
}

export type SpinBoxButtonState = 'normal' | 'disabled';

/** `is_fully_disabled = !is_editable()` (`spin_box.cpp:444`): gates both buttons whatever their own state. */
export function spinBoxFullyDisabled(props: SpinBoxProperties): boolean {
  return props.editable === false;
}

/**
 * `_update_buttons_state_for_current_value` (`spin_box.cpp:635-645`):
 * `value == max && !allow_greater` disables the up button;
 * `value == min && !allow_lesser` disables the down button.
 */
export function spinBoxUpButtonState(props: SpinBoxProperties, resolvedValue: number): SpinBoxButtonState {
  const max = props.maxValue ?? 100;
  if (spinBoxFullyDisabled(props)) return 'disabled';
  return resolvedValue === max && !props.allowGreater ? 'disabled' : 'normal';
}

export function spinBoxDownButtonState(props: SpinBoxProperties, resolvedValue: number): SpinBoxButtonState {
  const min = props.minValue ?? 0;
  if (spinBoxFullyDisabled(props)) return 'disabled';
  return resolvedValue === min && !props.allowLesser ? 'disabled' : 'normal';
}

/** `up_icon_modulate`/`up_disabled_icon_modulate` (`default_theme.cpp:634,637`). The icon asset is the same either way (`:616-619`), and only the modulate differs. */
const SPIN_BOX_UP_ICON_COLOR: Record<SpinBoxButtonState, ControlColor> = {
  normal: { r: 0.875, g: 0.875, b: 0.875, a: 1 },
  disabled: { r: 0.875, g: 0.875, b: 0.875, a: 0.5 },
};
/** `down_icon_modulate`/`down_disabled_icon_modulate` (`default_theme.cpp:638,641`): the same literals as the up pair. */
const SPIN_BOX_DOWN_ICON_COLOR = SPIN_BOX_UP_ICON_COLOR;

const SPIN_BOX_ICON_COLOR_KEYS: Record<'up' | 'down', Record<SpinBoxButtonState, string>> = {
  up: { normal: 'up_icon_modulate', disabled: 'up_disabled_icon_modulate' },
  down: { normal: 'down_icon_modulate', disabled: 'down_disabled_icon_modulate' },
};

/** A `theme_override_colors/<key>` override (already folded into `n.colors`) wins; else the default-theme literal for `direction`/`state`. */
export function spinBoxIconColor(
  colors: SolveNode['colors'],
  direction: 'up' | 'down',
  state: SpinBoxButtonState
): ControlColor {
  const key = SPIN_BOX_ICON_COLOR_KEYS[direction][state];
  const defaults = direction === 'up' ? SPIN_BOX_UP_ICON_COLOR : SPIN_BOX_DOWN_ICON_COLOR;
  return colors[key] ?? defaults[state];
}

/**
 * The field's scope: `line_edit->set_theme_type_variation("SpinBoxInnerLineEdit")` (`spin_box.cpp:728`)
 * based at `"LineEdit"`, as `ThemeOwner::get_theme_type_dependencies` walks it. An unregistered
 * variation falls through to the native chain (`buildThemeTypeChain`). `n`'s `"SpinBox"` scope
 * would miss `"LineEdit"`'s defaults and any project `"SpinBoxInnerLineEdit"` entry.
 */
export function spinBoxFieldThemeScope(n: Pick<SolveNode, 'themeChain' | 'projectTheme'>): ThemeResolutionScope {
  return themeResolutionScope('LineEdit', 'SpinBoxInnerLineEdit', n.themeChain, n.projectTheme);
}

export interface SpinBoxFieldTextTheme {
  fontSizePx: number;
  fontMetrics: FontMetrics;
  /** `control_font_color`/`control_font_disabled_color` (LineEdit's `font_color`/`font_uneditable_color` defaults). No ancestor-theme colour walk exists (`textTheme.ts`), so the field draws only this colour. */
  color: ControlColor;
}

/** The field's font (face + size, ancestor-walked) and colour (override-less default), for `editable` state. */
export function spinBoxFieldTextTheme(
  n: Pick<SolveNode, 'themeChain' | 'projectTheme' | 'path'>,
  ctx: Pick<SolveContext, 'theme'>,
  editable: boolean
): SpinBoxFieldTextTheme {
  const scope = spinBoxFieldThemeScope(n);
  const fontSizePx = resolveThemeFontSizeIn(scope, 'font_size', undefined, ctx.theme.fontSize);
  const fontResource = resolveThemeFontIn(scope, 'font', undefined);
  const fontMetrics = peekSceneFontMetrics(fontResource, n.path);
  return { fontSizePx, fontMetrics, color: editable ? LINE_EDIT_DEFAULT_FONT_COLOR : LINE_EDIT_DEFAULT_UNEDITABLE_COLOR };
}

/**
 * `SpinBox::get_minimum_size` (`spin_box.cpp:82-86`), with `line_edit->get_combined_minimum_size()`
 * as `LineEdit::get_minimum_size()` (`line_edit.cpp:2443-2477`) inline. It does not call
 * `lineEditMinimumSize`, which reads `n.styleBoxes['normal'/'read_only']` and so would leak the
 * SpinBox node's `theme_override_styles` into the field.
 */
export const spinBoxMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as SpinBoxProperties;
  const editable = props.editable !== false;
  const { fontSizePx, fontMetrics } = spinBoxFieldTextTheme(n, ctx, editable);

  // The field is `add_child`ed at construction (`spin_box.cpp:724-731`), never a scene node, so a
  // SpinBox's `theme_override_styles/*` address its own items (`up_background`, …). The field
  // always draws the default LineEdit box, hence `{}`.
  const normalBox: StyleBoxFlatData = pickLineEditStyleBox({}, ctx.theme.widgets.lineEdit, 'normal');
  const readOnlyBox: StyleBoxFlatData = pickLineEditStyleBox({}, ctx.theme.widgets.lineEdit, 'read_only');
  const normalMargin = contentMarginSize(normalBox);
  const readOnlyMargin = contentMarginSize(readOnlyBox);
  const styleMinSize = {
    x: Math.max(normalMargin.x, readOnlyMargin.x),
    y: Math.max(normalMargin.y, readOnlyMargin.y),
  };

  const emSpaceSize = ctx.measureText ? ctx.measureText('W', fontSizePx, 0, fontMetrics).x : 0;
  const fontHeightPx = getFontLinePitchPx(fontMetrics, fontSizePx, 0);

  const fieldMin = {
    x: styleMinSize.x + LINE_EDIT_MINIMUM_CHARACTER_WIDTH * emSpaceSize,
    y: styleMinSize.y + fontHeightPx,
  };

  return { x: fieldMin.x + spinBoxButtonsBlockWidth(spinBoxWidestButtonIconWidth(n)), y: fieldMin.y };
};
