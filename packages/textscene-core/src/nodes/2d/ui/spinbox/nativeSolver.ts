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
import { formatControlNumber } from '../../../../godot/text/numberFormat';
import type { MinimumSizeFn, TextureSlotsFn } from '../../../../r3f/controls/native/solverRegistry';
import { themedSlotRequests } from '../../../../r3f/controls/native/solverRegistry';
import { internalChildThemeItems, requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { shapeLineEditText } from '../lineedit/nativeSolver';
import { textBidiOptions } from '../../../../r3f/controls/native/text/textBidiOptions';
import { TextDirection } from '../../../../godot/text/textServerEnums';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { getFontLinePitchPx } from '../../../../r3f/controls/native/text/fontMetrics';
import type { FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import { peekSceneFontMetrics } from '../../../../r3f/controls/native/text/sceneFontLoader';
import {
  resolveThemeFontIn,
  resolveThemeFontSizeIn,
  themeResolutionScope,
  type ThemeResolutionScope,
} from '../../../../resources/styles/theme/lookup';
import { lineEditBoxes, lineEditStyleMinSize, lineEditTextMinimumWidth } from '../lineedit/nativeSolver';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { SpinBoxProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import { scaledIconSizeOf, themedIconSize } from '../../../../r3f/controls/native/scaledSvgIcon';
import type { Rgba } from '../../../../godot/math/math';
import { CONTROL_FONT_COLOR, CONTROL_FONT_DISABLED_COLOR } from '../../../../godot/scene/theme';

/** `Range`'s default `step` (`scene/gui/range.h:42`). SpinBox's constructor never calls `set_step` (`spin_box.cpp:723-740`), so this is what an unauthored `step` resolves to. */
const SPIN_BOX_STEP_DEFAULT = 1;

/**
 * `default_theme.cpp:647-648` sets `buttons_width`/`field_and_buttons_separation` as bare
 * literals, unlike the scaled ItemList neighbours at `default_theme.cpp:946-949`, so Godot
 * never multiplies either by `default_theme_scale`.
 */
const SPIN_BOX_BUTTONS_WIDTH = 16;
const SPIN_BOX_FIELD_BUTTONS_SEPARATION = 2;
/** `value_up.svg`/`value_down.svg` (`scene/theme/icons/`) declare `width="16" height="8"`. */
const SPIN_BOX_ARROW_ICON_SIZE: Vector2 = { x: 16, y: 8 };

/** The vendored arrows' size at the theme scale. */
export function spinBoxArrowIconSize(scale: number): Vector2 {
  return scaledIconSizeOf(SPIN_BOX_ARROW_ICON_SIZE, scale);
}

/** An arrow's top-left in its button's rect: `Point2i` centring, integer division (`spin_box.cpp:475-476`, `:490-491`). */
export function spinBoxArrowPosition(button: Rect2, iconSize: Vector2): Vector2 {
  return {
    x: button.x + Math.trunc((button.w - iconSize.x) / 2),
    y: button.y + Math.trunc((button.h - iconSize.y) / 2),
  };
}

/** `up`/`down`: `BIND_THEME_ITEM_CUSTOM(Theme::DATA_TYPE_ICON, SpinBox, up_icon, "up")` (and `down`, `spin_box.cpp:690,694`). The hover, pressed and disabled variants and the deprecated `updown` are never drawn, as in `Component.tsx`. */
type SpinBoxIconName = 'up' | 'down';
const SPIN_BOX_ICON_NAMES: readonly SpinBoxIconName[] = ['up', 'down'];

/** Which of `up`/`down` have a themed answer, for `SolveNode.textureSlots`. */
export const spinBoxTextureSlots: TextureSlotsFn = (_node, themedIcons = {}) => {
  return themedSlotRequests(SPIN_BOX_ICON_NAMES, themedIcons);
};

/** This icon's resolved size: themed if `SolveNode.textureSlots` resolved it, else the vendored default at `scale`. */
export function spinBoxIconSize(
  n: Pick<SolveNode, 'textureSlots'>,
  name: SpinBoxIconName,
  scale: number
): Vector2 {
  return themedIconSize(n.textureSlots, name, SPIN_BOX_ARROW_ICON_SIZE, scale);
}

/** `SpinBox::_get_widest_button_icon_width` (`spin_box.cpp:411-424`) over `up`/`down`, the icons this codebase draws. */
export function spinBoxWidestButtonIconWidth(n: Pick<SolveNode, 'textureSlots'>, scale: number): number {
  return Math.max(spinBoxIconSize(n, 'up', scale).x, spinBoxIconSize(n, 'down', scale).x);
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

/** `buttons_vertical_separation`: `default_theme.cpp:646` sets it to 0, and no per-node theme-constant override is modelled. */
const SPIN_BOX_BUTTONS_VERTICAL_SEPARATION = 0;

interface SpinBoxLayout {
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
export function spinBoxLayout(rectSize: Vector2, widestIconWidth: number, rtl = false): SpinBoxLayout {
  const w = Math.trunc(rectSize.x);
  const h = Math.trunc(rectSize.y);
  const blockWidth = spinBoxButtonsBlockWidth(widestIconWidth);
  const buttonsWidth = blockWidth - SPIN_BOX_FIELD_BUTTONS_SEPARATION;
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
    fieldAndButtonsSeparatorRect: { x: separatorLeft, y: 0, w: SPIN_BOX_FIELD_BUTTONS_SEPARATION, h },
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
 * `SpinBox::_update_text` (`spin_box.cpp:88-114`) for a still frame. The value takes the digits of
 * `locale` (`:91-93`). `line_edit->is_editing()` is always false, so the prefix and suffix always apply.
 * `accepted` stays `true` without a live edit, so the `update_on_text_changed` re-format never runs.
 */
export function spinBoxDisplayText(props: SpinBoxProperties, resolvedValue: number, locale: string): string {
  const step = props.step ?? SPIN_BOX_STEP_DEFAULT;
  let text = formatControlNumber(formatGodotNumber(resolvedValue, rangeStepDecimals(step)), {
    locale,
    localizeNumeralSystem: props.localizeNumeralSystem,
  });
  const prefix = props.prefix ?? '';
  const suffix = props.suffix ?? '';
  if (prefix !== '') text = `${prefix} ${text}`;
  if (suffix !== '') text = `${text} ${suffix}`;
  return text;
}

export type SpinBoxButtonState = 'normal' | 'disabled';

/** `is_fully_disabled = !is_editable()` (`spin_box.cpp:444`): gates both buttons whatever their own state. */
function spinBoxFullyDisabled(props: SpinBoxProperties): boolean {
  return props.editable === false;
}

/**
 * `_update_buttons_state_for_current_value` (`spin_box.cpp:635-645`):
 * `value == max && !allow_greater` disables the up button;
 * `value == min && !allow_lesser` disables the down button.
 */
/** `_update_buttons_state_for_current_value` (`spin_box.cpp:635-646`): a button disables at its bound unless the range lets the value go past it. */
export function spinBoxRangeButtonState(
  value: number,
  bound: number,
  allowsBeyond: boolean
): SpinBoxButtonState {
  return value === bound && !allowsBeyond ? 'disabled' : 'normal';
}

export function spinBoxUpButtonState(props: SpinBoxProperties, resolvedValue: number): SpinBoxButtonState {
  if (spinBoxFullyDisabled(props)) return 'disabled';
  return spinBoxRangeButtonState(resolvedValue, props.maxValue ?? 100, props.allowGreater === true);
}

export function spinBoxDownButtonState(props: SpinBoxProperties, resolvedValue: number): SpinBoxButtonState {
  if (spinBoxFullyDisabled(props)) return 'disabled';
  return spinBoxRangeButtonState(resolvedValue, props.minValue ?? 0, props.allowLesser === true);
}

/** `up_icon_modulate`/`up_disabled_icon_modulate` (`default_theme.cpp:634,637`). The icon asset is the same either way (`:616-619`), and only the modulate differs. */
const SPIN_BOX_UP_ICON_COLOR: Record<SpinBoxButtonState, Rgba> = {
  normal: CONTROL_FONT_COLOR,
  disabled: CONTROL_FONT_DISABLED_COLOR,
};
/** `down_icon_modulate`/`down_disabled_icon_modulate` (`default_theme.cpp:638,641`): the same colours as the up pair. */
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
): Rgba {
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
function spinBoxFieldThemeScope(n: Pick<SolveNode, 'themeChain' | 'projectFonts'>): ThemeResolutionScope {
  return themeResolutionScope('LineEdit', 'SpinBoxInnerLineEdit', n.themeChain, n.projectFonts);
}

/** The inner LineEdit's theme items: `LineEdit`'s, then `SpinBoxInnerLineEdit`'s, through the ancestor Theme chain. */
export function spinBoxFieldThemeItems(n: SolveNode) {
  return internalChildThemeItems(n, 'LineEdit', 'SpinBoxInnerLineEdit');
}

interface SpinBoxFieldTextTheme {
  fontSizePx: number;
  fontMetrics: FontMetrics;
  /** The field's `font_color`, or `font_uneditable_color` when not editable (`line_edit.cpp:1430-1442`). */
  color: Rgba;
}

/** The field's font (face + size) and colour, ancestor-walked, for `editable` state. */
export function spinBoxFieldTextTheme(n: SolveNode, editable: boolean): SpinBoxFieldTextTheme {
  const scope = spinBoxFieldThemeScope(n);
  const fontSizePx = resolveThemeFontSizeIn(scope, 'font_size', undefined);
  const fontResource = resolveThemeFontIn(scope, 'font', undefined);
  const fontMetrics = peekSceneFontMetrics(fontResource, n.path);
  const { colors } = spinBoxFieldThemeItems(n);
  return {
    fontSizePx,
    fontMetrics,
    color: editable
      ? requiredThemeItem(colors, 'font_color')
      : requiredThemeItem(colors, 'font_uneditable_color'),
  };
}

/**
 * The field's text shaped as its inner LineEdit shapes it. The field keeps `LineEdit`'s default
 * `text_direction` AUTO (`line_edit.h:144`) and sets no language, so neutral text takes the
 * direction of the project `locale` (`line_edit.cpp:3103-3112`), whatever the layout direction.
 */
export function shapeSpinBoxFieldText(
  text: string,
  { fontSizePx, fontMetrics }: Pick<SpinBoxFieldTextTheme, 'fontSizePx' | 'fontMetrics'>,
  locale: string
): TextLayoutResult {
  const bidi = textBidiOptions({ textDirection: TextDirection.TEXT_DIRECTION_AUTO, language: '' }, locale);
  return shapeLineEditText(text, {}, { ...bidi, fontSizePx, fontMetrics });
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
  const { fontSizePx, fontMetrics } = spinBoxFieldTextTheme(n, editable);

  // The field is `add_child`ed at construction (`spin_box.cpp:724-731`), so the SpinBox's own
  // `theme_override_styles/*` never reach it. It reads the Theme chain's LineEdit boxes only.
  const { styleBoxes } = spinBoxFieldThemeItems(n);
  const styleMinSize = lineEditStyleMinSize(lineEditBoxes(styleBoxes));

  const emSpaceSize = ctx.measureText ? ctx.measureText('W', fontSizePx, 0, fontMetrics).x : 0;
  const fontHeightPx = getFontLinePitchPx(fontMetrics, fontSizePx, 0);

  const fieldMin = {
    x: styleMinSize.x + lineEditTextMinimumWidth(emSpaceSize),
    y: styleMinSize.y + fontHeightPx,
  };

  return {
    x: fieldMin.x + spinBoxButtonsBlockWidth(spinBoxWidestButtonIconWidth(n, ctx.theme.scale)),
    y: fieldMin.y,
  };
};
