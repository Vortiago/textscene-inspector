/**
 * SpinBox's native rect solver: `SpinBox::get_minimum_size` (`scene/gui/spin_box.cpp:82-86`),
 * `_compute_sizes`/`_get_widest_button_icon_width` (`:382-427`), `_update_text` (`:88-114`) and
 * `_update_buttons_state_for_current_value` (`:635-645`), with its internal LineEdit. `Component.tsx`
 * paints the buttons, and the LineEdit's own painter draws the field.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { formatControlNumber } from '../../../../godot/text/numberFormat';
import { defaultConstant } from '../../../../godot/scene/defaultTheme/defaultTheme';
import type { MinimumSizeFn, TextureSlotsFn } from '../../../../r3f/controls/native/solverRegistry';
import { themedSlotRequests } from '../../../../r3f/controls/native/solverRegistry';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import { controlLayoutOrder, type SolveNode } from '../../../../r3f/controls/native/solveTree';
import {
  internalControlsOf,
  registerInternalControls,
  type InternalControlsFn,
  type InternalLayoutFn,
} from '../../../../r3f/controls/native/internalControls';
import { parseTextDirectionProperties } from '../../../../parser/textDirectionParser';
import { parseStructuredTextOverride } from '../../../../parser/structuredTextOverrideParser';
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import type { LineEditProperties } from '../lineedit/types';
import { resolveRangeValue } from '../shared/range';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { SpinBoxProperties } from './types';
import { VECTOR2_ZERO, type Vector2 } from '../../../../godot/math/vector';
import { themedIconSize } from '../../../../r3f/controls/native/scaledSvgIcon';
import type { Rgba } from '../../../../godot/math/math';

/** `Range`'s default `step` (`scene/gui/range.h:42`). SpinBox's constructor never calls `set_step` (`spin_box.cpp:723-740`), so this is what an unauthored `step` resolves to. */
const SPIN_BOX_STEP_DEFAULT = 1;

/** Godot never scales `buttons_width` or `field_and_buttons_separation`. */
const SPIN_BOX_BUTTONS_WIDTH = defaultConstant('SpinBox', 'buttons_width');
const SPIN_BOX_FIELD_BUTTONS_SEPARATION = defaultConstant('SpinBox', 'field_and_buttons_separation');
/** `value_up.svg`/`value_down.svg` (`scene/theme/icons/`) declare `width="16" height="8"`. */
const SPIN_BOX_ARROW_ICON_SIZE: Vector2 = { x: 16, y: 8 };

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
function spinBoxButtonsBlockWidth(widestIconWidth: number): number {
  return Math.max(SPIN_BOX_BUTTONS_WIDTH, widestIconWidth) + SPIN_BOX_FIELD_BUTTONS_SEPARATION;
}

/** The table's `SpinBox/buttons_vertical_separation`. No per-node theme-constant override is modelled. */
const SPIN_BOX_BUTTONS_VERTICAL_SEPARATION = defaultConstant('SpinBox', 'buttons_vertical_separation');

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
 * `SpinBox::_compute_sizes`'s geometry (`spin_box.cpp:382-410`). The buttons read `Size2i size =
 * get_size()`, truncated toward zero. The field is the LineEdit at full-rect anchors and offsets
 * `[0, -buttons_block_width]` (`:394-395`), so it keeps the fractional size. `rtl` puts the buttons
 * block at x 0 and the separator after it (`:403,409`).
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

  const separatorLeft = rtl ? buttonsWidth : Math.max(0, w - blockWidth);

  return {
    fieldRect: spinBoxFieldRect(rectSize, blockWidth, rtl),
    upRect: { x: buttonsLeft, y: 0, w: buttonsWidth, h: buttonUpHeight },
    downRect: { x: buttonsLeft, y: secondButtonTop, w: buttonsWidth, h: buttonDownHeight },
    fieldAndButtonsSeparatorRect: { x: separatorLeft, y: 0, w: SPIN_BOX_FIELD_BUTTONS_SEPARATION, h },
  };
}

/**
 * The LineEdit's rect: no RTL branch of its own, since `Control::_size_changed` mirrors it
 * (`control.cpp:1785-1787`) to `parent_width - x - w`.
 */
function spinBoxFieldRect(rectSize: Vector2, blockWidth: number, rtl: boolean): Rect2 {
  const w = Math.max(0, rectSize.x - blockWidth);
  return { x: rtl ? rectSize.x - w : 0, y: 0, w, h: rectSize.y };
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
function rangeStepDecimals(step: number): number {
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
function spinBoxDisplayText(props: SpinBoxProperties, resolvedValue: number, locale: string): string {
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

/** `_update_buttons_state_for_current_value` (`spin_box.cpp:635-646`): a button disables at its bound unless the range lets the value go past it. */
function spinBoxRangeButtonState(value: number, bound: number, allowsBeyond: boolean): SpinBoxButtonState {
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

const SPIN_BOX_ICON_COLOR_KEYS: Record<'up' | 'down', Record<SpinBoxButtonState, string>> = {
  up: { normal: 'up_icon_modulate', disabled: 'up_disabled_icon_modulate' },
  down: { normal: 'down_icon_modulate', disabled: 'down_disabled_icon_modulate' },
};

/** The arrow's modulate for `direction` and `state`. The icon is the same either way, and only the modulate differs. */
export function spinBoxIconColor(
  colors: SolveNode['colors'],
  direction: 'up' | 'down',
  state: SpinBoxButtonState
): Rgba {
  return requiredThemeItem(colors, SPIN_BOX_ICON_COLOR_KEYS[direction][state]);
}

/** `line_edit->set_theme_type_variation("SpinBoxInnerLineEdit")` (`spin_box.cpp:728`). */
const SPIN_BOX_FIELD_VARIATION = 'SpinBoxInnerLineEdit';

/** The field's name, so its path is `<spin box>/@LineEdit`. */
const SPIN_BOX_FIELD_NAME = 'LineEdit';

/**
 * The internal LineEdit (`spin_box.cpp:724-731`): left-aligned and editable by default, then given
 * the SpinBox's `alignment` (`:543`), `editable` (`:603`) and the text `_update_text` writes (`:88-114`).
 */
const spinBoxInternalControls: InternalControlsFn = (spinBox) => {
  const props = spinBox.node.properties as SpinBoxProperties;
  const value = resolveRangeValue(props, controlLayoutOrder(spinBox));
  const properties: Partial<LineEditProperties> = {
    ...parseTextDirectionProperties({}, 'LineEdit'),
    ...parseStructuredTextOverride({}),
    text: spinBoxDisplayText(props, value, spinBox.locale),
    editable: props.editable !== false,
    alignment: props.alignment ?? HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT,
  };
  const field = {
    type: 'LineEdit',
    name: SPIN_BOX_FIELD_NAME,
    properties,
    variation: SPIN_BOX_FIELD_VARIATION,
  };
  return [{ mode: 'front', spec: field }];
};

/** `_compute_sizes` (`:382-397`): the field fills the SpinBox less the buttons block. */
const spinBoxInternalLayout: InternalLayoutFn = (spinBox, internals, rect, ctx) => {
  const widestIconWidth = spinBoxWidestButtonIconWidth(spinBox, ctx.theme.scale);
  const { fieldRect } = spinBoxLayout({ x: rect.w, y: rect.h }, widestIconWidth, spinBox.rtl);
  return new Map(internals.map(({ node }) => [node.path, fieldRect]));
};

/** `SpinBox::get_minimum_size` (`spin_box.cpp:82-86`): the field's combined minimum plus the buttons block. */
export const spinBoxMinimumSize: MinimumSizeFn = (n, ctx) => {
  const [field] = internalControlsOf(n, ctx.theme);
  const fieldMin = field ? ctx.combinedMinimumSize(field.node) : VECTOR2_ZERO;
  return {
    x: fieldMin.x + spinBoxButtonsBlockWidth(spinBoxWidestButtonIconWidth(n, ctx.theme.scale)),
    y: fieldMin.y,
  };
};

registerInternalControls('SpinBox', spinBoxInternalControls, spinBoxInternalLayout);
