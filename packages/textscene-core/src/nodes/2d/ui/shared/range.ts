/**
 * Shared Range base for the Control slices whose geometry follows a value in
 * `[min_value, max_value]`. `Range` is Godot's abstract base, so its properties and ratio formula
 * live here, in pure `.ts` that parsers inside the linter graph can import.
 */

import { parseOptionalBool, parseOptionalFloat } from '../../../../parser/valueParsers';
import { isEqualApprox } from '../../../../godot/index.js';

export interface RangeProperties {
  /** Current value. Godot default 0. */
  value?: number;
  /** Lower bound. Godot default 0. */
  minValue?: number;
  /** Upper bound. Godot default 100. */
  maxValue?: number;
  /**
   * Quantisation of `value`. Godot's `Range` default is 0.01; `Slider`
   * overrides it to 1.0. `_calc_value` snaps to it whenever it is above zero,
   * measured from `min` (`range.cpp:184-186`), so an authored value off the
   * grid is not the value the engine holds.
   */
  step?: number;
  /**
   * The page size: `Range::_calc_value` clamps `value` at `max_value - page` (`range.cpp:190-192`).
   * Godot default 0 (`range.h:43`). `rangeRatio` ignores it, as `get_as_ratio()`'s `CLAMP(value,
   * min, max)` in `range.cpp` does, so a slider's fill spans `[min, max]`. `resolveRangeValue` needs
   * it, since `set_page` re-clamps `value`.
   */
  page?: number;
  /** `exp_edit`: distribute `value` logarithmically across the range. */
  expEdit?: boolean;
  /** `rounded`: `_calc_value` rounds to the nearest integer (`range.cpp:188-190`). Godot default false. */
  rounded?: boolean;
  /** `allow_greater`: lifts `_calc_value`'s `max - page` ceiling (`range.cpp:193-195`). Godot default false. */
  allowGreater?: boolean;
  /** `allow_lesser`: lifts `_calc_value`'s `min` floor (`range.cpp:197-199`). Godot default false. */
  allowLesser?: boolean;
}

/** Godot `Range` property defaults (doc/classes/Range.xml). */
export const RANGE_DEFAULT_VALUE = 0;
export const RANGE_DEFAULT_MIN = 0;
export const RANGE_DEFAULT_MAX = 100;
/** `range.h:43`. */
export const RANGE_DEFAULT_PAGE = 0;

/**
 * Per-subclass Range defaults the caller supplies, since `Range` records none. `_calc_value` snaps
 * to `step`, and `ClassDB.class_get_property_default_value` (4.6.3) gives HSlider, VSlider, SpinBox
 * and TextureProgressBar 1.0, ProgressBar 0.01 and the scrollbars 0.0 (no snap). An absent `step`
 * read as no snap draws a slider at a value Godot never holds.
 */
export interface RangeDefaults {
  step?: number;
}

/** Parse the `Range` properties out of a node's raw property map. */
export function parseRange(
  properties: Record<string, string>,
  defaults: RangeDefaults = {}
): RangeProperties {
  return {
    value: parseOptionalFloat(properties.value),
    minValue: parseOptionalFloat(properties.min_value),
    maxValue: parseOptionalFloat(properties.max_value),
    step: parseOptionalFloat(properties.step) ?? defaults.step,
    page: parseOptionalFloat(properties.page),
    expEdit: parseOptionalBool(properties.exp_edit),
    rounded: parseOptionalBool(properties.rounded),
    allowGreater: parseOptionalBool(properties.allow_greater),
    allowLesser: parseOptionalBool(properties.allow_lesser),
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * `Range::get_as_ratio()` (scene/gui/range.cpp): the 0..1 position of `value` in `[min, max]` that
 * `Slider` multiplies its travel by. A degenerate range returns 1.0, and the `exp_ratio` branch
 * (guarded by `get_min() >= 0`) spaces the value by log2. `get_value()` is `shared->val` as the
 * setters left it, so `resolveRangeValue` (ADR-0035) replays `orderedKeys`.
 */
export function rangeRatio(props: RangeProperties, orderedKeys?: RangeValueOrder): number {
  const min = props.minValue ?? RANGE_DEFAULT_MIN;
  const max = props.maxValue ?? RANGE_DEFAULT_MAX;
  const raw = resolveRangeValue(props, orderedKeys);

  if (isEqualApprox(max, min)) return 1;

  const value = clamp(raw, min, max);
  if (props.expEdit && min >= 0) {
    // Godot takes log(x)/log(2) and lets `min == 0` short-circuit to 0 rather than
    // log2(0) = -Infinity. A clamped `value` of 0 still yields -Infinity, which CLAMP pins
    // to 0, as the engine does.
    const expMin = min === 0 ? 0 : Math.log2(min);
    const expMax = Math.log2(max);
    return clamp((Math.log2(value) - expMin) / (expMax - expMin), 0, 1);
  }
  return clamp((value - min) / (max - min), 0, 1);
}

/**
 * A node's raw `.tscn` property keys in file order, or `undefined` when the order is unknown or
 * unreliable. `controlLayoutOrder(n)` in `native/solveTree.ts` produces it from
 * `TscnNode.rawPropertiesOrderReliable` (ADR-0035), as for `controlAnchors.ts`'s `ControlLayoutOrder`.
 */
export type RangeValueOrder = readonly string[] | undefined;

interface RangeSimState {
  min: number;
  max: number;
  page: number;
  val: number;
  /** Constant through the replay: none of the four gates has a setter that re-clamps. */
  gates: RangeValueGates;
}

/**
 * `Range::_calc_value` (`range.cpp:182-200`): the terms `value`'s setter applies, in the engine's
 * order: snap to `step` from `min`, round, then two gated clamps. `allow_greater` lifts the
 * `max - page` ceiling and `allow_lesser` the `min` floor, so such a scene holds a value outside
 * its bounds and Godot draws it there.
 */
function calcValue(val: number, min: number, max: number, page: number, gates: RangeValueGates = {}): number {
  let v = val;
  // Measured from `min`, so a range starting at 0.1 with step 0.2 snaps to
  // 0.1/0.3/0.5 rather than to multiples of 0.2 (`range.cpp:184-186`).
  if (gates.step !== undefined && gates.step > 0) v = snapped(v - min, gates.step) + min;
  if (gates.rounded) v = Math.round(v);
  if (!gates.allowGreater && v > max - page) v = max - page;
  if (!gates.allowLesser && v < min) v = min;
  return v;
}

/** The `_calc_value` terms that are properties rather than bounds. */
interface RangeValueGates {
  step?: number;
  rounded?: boolean;
  allowGreater?: boolean;
  allowLesser?: boolean;
}

/** `Math::snapped` (`core/math/math_funcs.h`): `_snapped_r128`'s fallback, and its answer wherever a double holds the result exactly. */
function snapped(value: number, step: number): number {
  return Math.floor(value / step + 0.5) * step;
}

/** Every `_calc_value` gate a node authored, read once per call site. */
function gatesOf(props: RangeProperties): RangeValueGates {
  return {
    step: props.step,
    rounded: props.rounded,
    allowGreater: props.allowGreater,
    allowLesser: props.allowLesser,
  };
}

/** `Range::set_min` (`range.cpp:211-226`). Through the early return (`:212-214`), a redundant `min_value` line does nothing, not even re-clamp `value`. */
function applyMinValue(state: RangeSimState, min: number): void {
  if (state.min === min) return;
  state.min = min;
  state.max = Math.max(state.max, state.min); // :217
  state.page = clamp(state.page, 0, state.max - state.min); // :218
  state.val = calcValue(state.val, state.min, state.max, state.page, state.gates); // :219, set_value(shared->val)
}

/** `Range::set_max` (`range.cpp:228-241`): validates against `min` before the early return (`:229-232`). */
function applyMaxValue(state: RangeSimState, max: number): void {
  const validated = Math.max(max, state.min); // :229
  if (state.max === validated) return; // :230-232
  state.max = validated;
  state.page = clamp(state.page, 0, state.max - state.min); // :235
  state.val = calcValue(state.val, state.min, state.max, state.page, state.gates); // :236
}

/** `Range::set_page` (`range.cpp:254-266`): the same early-return shape as `set_min`/`set_max`. */
function applyPage(state: RangeSimState, page: number): void {
  const validated = clamp(page, 0, state.max - state.min); // :255
  if (state.page === validated) return; // :256-258
  state.page = validated;
  state.val = calcValue(state.val, state.min, state.max, state.page, state.gates); // :261
}

/** `Range::set_value` → `_set_value_no_signal` → `_calc_value` (`range.cpp:168-180,182-200`). No early return: `value`'s setter always recomputes. */
function applyValue(state: RangeSimState, value: number): void {
  state.val = calcValue(value, state.min, state.max, state.page, state.gates);
}

/**
 * `Range::get_value()`'s final `shared->val`: replays `min_value`/`max_value`/`page`/`value` in
 * `.tscn` order through their setters (ADR-0035, Option B). `set_step` (`range.cpp:243-252`) calls
 * no `set_value`, so it cannot change what the others compute. `rangeRatio` clamps on top.
 */
export function resolveRangeValue(props: RangeProperties, orderedKeys: RangeValueOrder): number {
  if (!orderedKeys) {
    // Editor-save order puts the bounds before `value`, so one `calcValue` against the final
    // `min_value`/`max_value`/`page` is what the replay computes.
    const min = props.minValue ?? RANGE_DEFAULT_MIN;
    const max = props.maxValue ?? RANGE_DEFAULT_MAX;
    const page = props.page ?? RANGE_DEFAULT_PAGE;
    return calcValue(props.value ?? RANGE_DEFAULT_VALUE, min, max, page, gatesOf(props));
  }

  const state: RangeSimState = {
    min: RANGE_DEFAULT_MIN,
    max: RANGE_DEFAULT_MAX,
    page: RANGE_DEFAULT_PAGE,
    val: RANGE_DEFAULT_VALUE,
    gates: gatesOf(props),
  };

  for (const key of orderedKeys) {
    switch (key) {
      case 'min_value':
        if (props.minValue !== undefined) applyMinValue(state, props.minValue);
        break;
      case 'max_value':
        if (props.maxValue !== undefined) applyMaxValue(state, props.maxValue);
        break;
      case 'page':
        if (props.page !== undefined) applyPage(state, props.page);
        break;
      case 'value':
        if (props.value !== undefined) applyValue(state, props.value);
        break;
      default:
        break;
    }
  }

  return state.val;
}
