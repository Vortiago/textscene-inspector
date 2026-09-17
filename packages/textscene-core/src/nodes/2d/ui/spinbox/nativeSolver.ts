/**
 * SpinBox's native (WebGL canvas) rect solver — `SpinBox::get_minimum_size`
 * (`scene/gui/spin_box.cpp:82-86`), `_compute_sizes`/`_get_widest_button_icon_width`
 * (`:382-427`), `_update_text` (`:88-114`) and `_update_buttons_state_for_current_value`
 * (`:635-645`). Registered via `controlSolverRegistry.registerMinimumSize`.
 * Pure per-node math, no THREE/React — painting is `Component.tsx`'s job.
 *
 * SpinBox's internal `LineEdit` field is never a scene node (`SpinBoxLineEdit`
 * is `add_child`ed at construction, `spin_box.cpp:724-731`, so a `.tscn` names
 * no properties for it directly). Its StyleBox therefore has no per-node
 * override surface here — `theme_override_styles/*` authored on a SpinBox
 * NODE addresses SpinBox's OWN items (`up_background`, …), never the field —
 * so the field always draws the plain default-theme LineEdit box
 * (`theme.widgets.lineEdit`), reused from `../lineedit/nativeSolver.ts` rather
 * than re-derived. Its font, however, DOES walk the real ancestor Theme chain:
 * the field's real theme scope is `"SpinBoxInnerLineEdit"` (`set_theme_type_variation`,
 * `spin_box.cpp:728`), based at `"LineEdit"` — `spinBoxFieldThemeScope` below
 * builds that scope directly through `resources/styles/theme/lookup.ts`
 * (an unregistered variation falls straight through to the native chain,
 * `buildThemeTypeChain`'s own doc — exactly Godot's own behaviour), so a
 * project Theme that styles `LineEdit`'s font still reaches this field.
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

/** `Range`'s own default `step` (`scene/gui/range.h:42`) — SpinBox's constructor never calls `set_step` (`spin_box.cpp:723-740`), so this is what an unauthored `step` resolves to. */
export const SPIN_BOX_STEP_DEFAULT = 1;

/**
 * `default_theme.cpp:647-648` sets `buttons_width`/`field_and_buttons_separation`
 * as bare literals, unlike their scaled `default_theme.cpp:946-949` ItemList
 * neighbours — Godot never multiplies either by `default_theme_scale`, so this
 * codebase does not reconstruct one for them either.
 */
const SPIN_BOX_BUTTONS_WIDTH = 16;
const SPIN_BOX_FIELD_BUTTONS_SEPARATION = 2;
/**
 * `value_up.svg`/`value_down.svg` (`scene/theme/icons/`) both declare
 * `width="16" height="8"`. Vendored icons are never rescaled by the project
 * theme scale in this codebase (`checkbox/nativeSolver.ts`'s
 * `CHECKBOX_ICON_NATURAL_SIZE` doc) — an established limitation, not a new
 * one this slice introduces.
 */
export const SPIN_BOX_ARROW_ICON_SIZE: Vec2 = { x: 16, y: 8 };

/** `up`/`down` — `BIND_THEME_ITEM_CUSTOM(Theme::DATA_TYPE_ICON, SpinBox, up_icon, "up")` (and `down`, `spin_box.cpp:690,694`). The hover/pressed/disabled variants (and the deprecated `updown`) are never drawn here — see this module's own header, matching `Component.tsx`'s draw-state simplification. */
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

/** This icon's resolved size — themed if `SolveNode.textureSlots` resolved it, else the vendored default. */
export function spinBoxIconSize(n: Pick<SolveNode, 'textureSlots'>, name: SpinBoxIconName): Vec2 {
  return n.textureSlots[name] ?? SPIN_BOX_ARROW_ICON_SIZE;
}

/**
 * `SpinBox::_get_widest_button_icon_width` (`spin_box.cpp:411-424`),
 * restricted to `up`/`down` (no deprecated `updown`, no hover/pressed/
 * disabled variants — see `SPIN_BOX_ICON_NAMES`'s own doc, which is exactly
 * what this codebase draws).
 */
export function spinBoxWidestButtonIconWidth(n: Pick<SolveNode, 'textureSlots'>): number {
  return Math.max(spinBoxIconSize(n, 'up').x, spinBoxIconSize(n, 'down').x);
}

/**
 * `SpinBox::_compute_sizes` (`spin_box.cpp:382-397`), restricted to the
 * DEFAULT theme's own `set_min_buttons_width_from_icons = 1` (true, no
 * per-node theme-constant override is modelled anywhere in this codebase —
 * `shared/scrollBarSolver.ts`'s own doc). `widestIconWidth` is
 * `spinBoxWidestButtonIconWidth`'s answer for whichever `SolveNode` is
 * asking (the vendored 16 when nothing themed either icon, matching the
 * codebase's previous hardcoded behaviour exactly).
 */
export function spinBoxButtonsBlockWidth(widestIconWidth: number): number {
  const separation = SPIN_BOX_FIELD_BUTTONS_SEPARATION;
  const wanted = SPIN_BOX_BUTTONS_WIDTH + separation;
  const iconEnforced = widestIconWidth + separation;
  return Math.max(wanted, iconEnforced);
}

/** `field_and_buttons_separation` alone (`default_theme.cpp:647`) — the gap between the buttons BLOCK and the narrower buttons themselves (`sizing_cache.buttons_width = w - theme_cache.field_and_buttons_separation`, `spin_box.cpp:401`). */
export function spinBoxFieldButtonsSeparation(): number {
  return SPIN_BOX_FIELD_BUTTONS_SEPARATION;
}

/** `buttons_vertical_separation` theme constant — `default_theme.cpp:646` sets it to 0, and this codebase models no per-node theme-constant override. */
const SPIN_BOX_BUTTONS_VERTICAL_SEPARATION = 0;

export interface SpinBoxLayout {
  /** The internal field's own rect — `line_edit`'s full-rect preset with a right offset of `-buttons_block_width` (`spin_box.cpp:394-395`). */
  fieldRect: Rect2;
  /** The up (increment) button's own rect. */
  upRect: Rect2;
  /** The down (decrement) button's own rect. */
  downRect: Rect2;
  /** `field_and_buttons_separator`'s own rect (`spin_box.cpp:409-410,482`) — the full-height gap between the field and the buttons block. `up_down_buttons_separator` is not exposed: its own rect's height is always `SPIN_BOX_BUTTONS_VERTICAL_SEPARATION` (0), permanently zero-area, since this codebase models no per-node override for that theme constant. */
  fieldAndButtonsSeparatorRect: Rect2;
}

/**
 * `SpinBox::_compute_sizes`'s remaining, per-draw geometry (`spin_box.cpp:399-410`).
 * `Size2i size = get_size();` truncates both components toward zero on
 * assignment, so `rectSize` is truncated once up front, matching every other
 * `int(...)` cast this function's source performs.
 *
 * `rtl` is the node's own `is_layout_rtl()` (`SolveNode.rtl`): it puts the
 * buttons block at x 0 and the separator directly after it (`:403,409`). The
 * field carries no `is_layout_rtl()` branch of its own — it is the internal
 * `LineEdit`'s full-rect preset at offsets `[0, -buttons_block_width]`
 * (`:394-395`), and its OWN `Control::_size_changed` mirror
 * (`control.cpp:1785-1787`) moves it to `parent_width - x - w`.
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
  const fieldLeft = rtl ? w - fieldWidth : 0;
  const separatorLeft = rtl ? buttonsWidth : fieldWidth;

  return {
    fieldRect: { x: fieldLeft, y: 0, w: fieldWidth, h },
    upRect: { x: buttonsLeft, y: 0, w: buttonsWidth, h: buttonUpHeight },
    downRect: { x: buttonsLeft, y: secondButtonTop, w: buttonsWidth, h: buttonDownHeight },
    fieldAndButtonsSeparatorRect: { x: separatorLeft, y: 0, w: spinBoxFieldButtonsSeparation(), h },
  };
}

// --- Displayed text: `_update_text` (spin_box.cpp:88-114) -------------------

/**
 * `Math::step_decimals` (`core/math/math_funcs.cpp:61-85`) — how many decimal
 * digits `step`'s own fractional part needs, capped at 9 (the table this
 * ports has 10 entries, index 0..9).
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

/** `Math::range_step_decimals` (`core/math/math_funcs.cpp:89-94`) — `step < 1e-13` (an unset/zero step) means "don't limit `String::num`'s digits". */
export function rangeStepDecimals(step: number): number {
  if (step < 0.0000000000001) return 16;
  return stepDecimals(step);
}

/**
 * `String::num(value, decimals)` (`core/string/ustring.cpp:1405-1481`),
 * restricted to `decimals >= 0` — the only case `range_step_decimals` ever
 * feeds it (`nan`/`inf` are excluded too: `Range::_calc_value` never produces
 * either from finite inputs, and a `.tscn` `value`/`step` of `nan`/`inf` is
 * already a linter error). Trims trailing zeroes past the decimal point but
 * always keeps exactly one digit after it once any were printed
 * (`ustring.cpp:1467-1481`).
 */
export function formatGodotNumber(value: number, decimals: number): string {
  const fixed = value.toFixed(Math.min(decimals, 32));
  if (!fixed.includes('.')) return fixed;
  let trimmed = fixed.replace(/0+$/, '');
  if (trimmed.endsWith('.')) trimmed += '0';
  return trimmed;
}

/**
 * `SpinBox::_update_text` (`spin_box.cpp:88-114`), restricted to the static
 * case: `line_edit->is_editing()` is always false (no interactive caret/focus
 * state, `LineEdit`'s own doc) so the prefix/suffix wrap always applies, and
 * `accepted` starts (and stays) `true` absent a live text edit, so the
 * `update_on_text_changed` re-format branch never triggers.
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

// --- Stepper button state: `_update_buttons_state_for_current_value` --------

export type SpinBoxButtonState = 'normal' | 'disabled';

/** `is_fully_disabled = !is_editable()` (`spin_box.cpp:444`) — gates BOTH buttons regardless of their own state below. */
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

/** `up_icon_modulate`/`up_disabled_icon_modulate` (`default_theme.cpp:634,637`) — SAME icon asset either way (`:616-619`), only the modulate differs. */
const SPIN_BOX_UP_ICON_COLOR: Record<SpinBoxButtonState, ControlColor> = {
  normal: { r: 0.875, g: 0.875, b: 0.875, a: 1 },
  disabled: { r: 0.875, g: 0.875, b: 0.875, a: 0.5 },
};
/** `down_icon_modulate`/`down_disabled_icon_modulate` (`default_theme.cpp:638,641`) — identical literals to the up pair. */
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

// --- Field theme scope: `"SpinBoxInnerLineEdit"` based at `"LineEdit"` ------

/**
 * `line_edit->set_theme_type_variation("SpinBoxInnerLineEdit")`
 * (`spin_box.cpp:728`). No `.tscn` can register that variation on the field
 * itself (it is never a scene node), but a project Theme resource CAN declare
 * `"SpinBoxInnerLineEdit"` as a real type variation (`base_type = "LineEdit"`)
 * the ordinary way — this scope reaches that, exactly like Godot's own
 * `ThemeOwner::get_theme_type_dependencies` walk, by asking for the
 * variation directly rather than reusing `n`'s own `"SpinBox"` scope (which
 * would search under the WRONG class name and miss both `"LineEdit"`'s
 * defaults and any real `"SpinBoxInnerLineEdit"` entry).
 */
export function spinBoxFieldThemeScope(n: Pick<SolveNode, 'themeChain' | 'projectTheme'>): ThemeResolutionScope {
  return themeResolutionScope('LineEdit', 'SpinBoxInnerLineEdit', n.themeChain, n.projectTheme);
}

export interface SpinBoxFieldTextTheme {
  fontSizePx: number;
  fontMetrics: FontMetrics;
  /** `control_font_color`/`control_font_disabled_color` (LineEdit's own `font_color`/`font_uneditable_color` defaults) — no ancestor-theme colour walk exists in this codebase (`textTheme.ts`'s own doc), so this is the ONLY colour the field ever draws. */
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

// --- Minimum size: `SpinBox::get_minimum_size` (spin_box.cpp:82-86) ---------

/**
 * `line_edit->get_combined_minimum_size()` — `LineEdit::get_minimum_size()`
 * (`line_edit.cpp:2443-2477`) reproduced inline rather than calling
 * `lineedit/nativeSolver.ts`'s `lineEditMinimumSize` on a hand-built node:
 * that function reads `n.styleBoxes['normal'/'read_only']`, a SpinBox NODE's
 * own (inert-for-the-field, per this module's header) `theme_override_styles`
 * would leak in through it. `{}` here is the correct "no override reaches the
 * field" input, spelled out rather than borrowed.
 */
export const spinBoxMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as SpinBoxProperties;
  const editable = props.editable !== false;
  const { fontSizePx, fontMetrics } = spinBoxFieldTextTheme(n, ctx, editable);

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
