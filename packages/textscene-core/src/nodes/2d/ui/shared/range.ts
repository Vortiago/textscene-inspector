/**
 * Shared Range base for the Control slices whose geometry is driven by a value
 * inside `[min_value, max_value]` (the sliders today). `Range` is Godot's
 * abstract base class, so its properties and its ratio formula live ONCE here —
 * the `shared/boxContainer.ts` pattern for a slice family. Pure `.ts` (no
 * React/THREE) so parsers can import it inside the linter graph.
 */

import { parseOptionalBool, parseOptionalFloat } from '../../../../parser/valueParsers';

export interface RangeProperties {
  /** Current value. Godot default 0. */
  value?: number;
  /** Lower bound. Godot default 0. */
  minValue?: number;
  /** Upper bound. Godot default 100. */
  maxValue?: number;
  /**
   * Quantisation of `value`. Godot's `Range` default is 0.01; `Slider`
   * overrides it to 1.0. Purely an input concern — a static preview draws the
   * authored `value` whether or not it is a multiple of `step`.
   */
  step?: number;
  /**
   * The "page size" of a scrollable range — `value`'s clamp ceiling is
   * `max_value - page`, not `max_value` alone (`Range::_calc_value`,
   * `range.cpp:190-192`). Godot default 0 (`range.h:43`), which collapses the
   * ceiling back to plain `max_value`. Not read by `rangeRatio`'s DISPLAY
   * math (`get_as_ratio()`'s own `CLAMP(value, min, max)` ignores it too,
   * `range.cpp` — a slider's fill still spans the full [min, max] visually);
   * only `resolveRangeValue`'s file-order simulation needs it, since
   * `set_page` is one more setter that re-clamps `value` as a side effect.
   */
  page?: number;
  /** `exp_edit`: distribute `value` logarithmically across the range. */
  expEdit?: boolean;
}

/** Godot `Range` property defaults (doc/classes/Range.xml). */
export const RANGE_DEFAULT_VALUE = 0;
export const RANGE_DEFAULT_MIN = 0;
export const RANGE_DEFAULT_MAX = 100;
/** `range.h:43`. */
export const RANGE_DEFAULT_PAGE = 0;

/** Parse the `Range` properties out of a node's raw property map. */
export function parseRange(properties: Record<string, string>): RangeProperties {
  return {
    value: parseOptionalFloat(properties.value),
    minValue: parseOptionalFloat(properties.min_value),
    maxValue: parseOptionalFloat(properties.max_value),
    step: parseOptionalFloat(properties.step),
    page: parseOptionalFloat(properties.page),
    expEdit: parseOptionalBool(properties.exp_edit),
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * Godot `Math::is_equal_approx(double, double)` (core/math/math_funcs.h):
 * exact equality first (so infinities compare equal), then a relative tolerance
 * of `CMP_EPSILON * abs(a)` floored at `CMP_EPSILON` (1e-5).
 */
function isEqualApprox(a: number, b: number): boolean {
  if (a === b) return true;
  const tolerance = Math.max(1e-5 * Math.abs(a), 1e-5);
  return Math.abs(a - b) < tolerance;
}

/**
 * `Range::get_as_ratio()` (scene/gui/range.cpp) — the 0..1 position of `value`
 * within `[min, max]`, which is what `Slider` multiplies its travel by:
 *
 *     if (Math::is_equal_approx(get_max(), get_min())) { return 1.0; }
 *     ...
 *     double value = CLAMP(get_value(), shared->min, shared->max);
 *     return CLAMP((value - get_min()) / (get_max() - get_min()), 0, 1);
 *
 * A degenerate range returns 1.0 rather than dividing by zero, and the
 * `exp_ratio` branch (guarded by `get_min() >= 0`) spaces the value by log2.
 *
 * `get_value()` is `shared->val` — the value AS `Range`'s own setters last
 * left it, not the raw authored float — so `orderedKeys` (when given) threads
 * through `resolveRangeValue`'s file-order simulation (ADR-0035) rather than
 * reading `props.value` directly.
 */
export function rangeRatio(props: RangeProperties, orderedKeys?: RangeValueOrder): number {
  const min = props.minValue ?? RANGE_DEFAULT_MIN;
  const max = props.maxValue ?? RANGE_DEFAULT_MAX;
  const raw = resolveRangeValue(props, orderedKeys);

  if (isEqualApprox(max, min)) return 1;

  const value = clamp(raw, min, max);
  if (props.expEdit && min >= 0) {
    // Godot takes log(x)/log(2) — log2 — and lets `min == 0` short-circuit to 0
    // rather than log2(0) = -Infinity. A clamped `value` of 0 still yields
    // -Infinity here, which CLAMP pins to 0, exactly as the engine does.
    const expMin = min === 0 ? 0 : Math.log2(min);
    const expMax = Math.log2(max);
    return clamp((Math.log2(value) - expMin) / (expMax - expMin), 0, 1);
  }
  return clamp((value - min) / (max - min), 0, 1);
}

// --- File-order-aware value resolution (ADR-0035, Option B) -----------------

/**
 * A node's raw `.tscn` property keys, in real file order — `undefined` when
 * that order is unknown or unreliable. `native/solveTree.ts`'s
 * `controlLayoutOrder(n)` is the usual producer (reads
 * `TscnNode.rawPropertiesOrderReliable`, ADR-0035) — the SAME helper
 * `controlAnchors.ts`'s `ControlLayoutOrder` uses, since both read the
 * identical node-level fact.
 */
export type RangeValueOrder = readonly string[] | undefined;

interface RangeSimState {
  min: number;
  max: number;
  page: number;
  val: number;
}

/**
 * `Range::_calc_value` (`range.cpp:182-200`), with `allow_greater`/
 * `allow_lesser` at their struct defaults — both `false` (`range.h:45-46`).
 * Neither `RangeProperties` nor any `.tscn` reader in this codebase parses
 * `allow_greater`/`allow_lesser`, so there is no authored value to read even
 * if this modelled the gate.
 *
 * The `p_step > 0` snap term (`range.cpp:184-186`) is DELIBERATELY not
 * modelled: `rangeRatio` has never snapped `value` to `step` (this function
 * predates ADR-0035), so adding it here would be a rendering-fidelity change
 * unrelated to file order, not an order-sensitivity fix. `RangeProperties`
 * does not even carry `step` into this function for that reason.
 */
function calcValue(val: number, min: number, max: number, page: number): number {
  let v = val;
  if (v > max - page) v = max - page;
  if (v < min) v = min;
  return v;
}

/** `Range::set_min` (`range.cpp:211-226`) — the early return (`:212-214`) is load-bearing: a redundant `min_value` line does nothing at all, not even re-clamp `value`. */
function applyMinValue(state: RangeSimState, min: number): void {
  if (state.min === min) return;
  state.min = min;
  state.max = Math.max(state.max, state.min); // :217
  state.page = clamp(state.page, 0, state.max - state.min); // :218
  state.val = calcValue(state.val, state.min, state.max, state.page); // :219, set_value(shared->val)
}

/** `Range::set_max` (`range.cpp:228-241`) — validates against `min` BEFORE the early-return check (`:229-232`). */
function applyMaxValue(state: RangeSimState, max: number): void {
  const validated = Math.max(max, state.min); // :229
  if (state.max === validated) return; // :230-232
  state.max = validated;
  state.page = clamp(state.page, 0, state.max - state.min); // :235
  state.val = calcValue(state.val, state.min, state.max, state.page); // :236
}

/** `Range::set_page` (`range.cpp:254-266`) — same early-return shape as `set_min`/`set_max`. */
function applyPage(state: RangeSimState, page: number): void {
  const validated = clamp(page, 0, state.max - state.min); // :255
  if (state.page === validated) return; // :256-258
  state.page = validated;
  state.val = calcValue(state.val, state.min, state.max, state.page); // :261
}

/** `Range::set_value` → `_set_value_no_signal` → `_calc_value` (`range.cpp:168-180,182-200`). No early return — `value`'s own setter always recomputes. */
function applyValue(state: RangeSimState, value: number): void {
  state.val = calcValue(value, state.min, state.max, state.page);
}

/**
 * Resolves a Range's effective `value` — `Range::get_value()`'s final
 * `shared->val`, per file order (ADR-0035, Option B) — by REPLAYING
 * `min_value`/`max_value`/`page`/`value` in the order the `.tscn` lists them,
 * a direct simulation of the four setters involved rather than a pairwise
 * "does X come before Y" rule. `set_step` (`range.cpp:243-252`) is excluded
 * from the replay entirely: it has no re-clamp side effect of its own (no
 * `set_value` call), so it can never change which of the OTHER four keys'
 * events fire or what they compute — the ONE setter of the five this ADR's
 * breadth survey names that genuinely is inert as a trigger.
 *
 * `orderedKeys === undefined` (order unknown or unreliable) assumes
 * editor-save order — bounds authored before value — WITHOUT replaying file
 * order: under that assumption, `min`/`max`/`page` never change again after
 * `value`'s own setter runs, so `value`'s setter sees exactly the FINAL
 * parsed `min_value`/`max_value`/`page`, and one `calcValue` call against
 * those reproduces what the full replay would compute. `page`'s ceiling is
 * order-INDEPENDENT in this one sense — it is the LAST page/min/max state
 * whichever order produces it — so leaving it out of this branch (as this
 * function did before this fix) was an inconsistency with the order-aware
 * branch below, not a deliberate simplification: a merged-instance-root
 * Range authoring `page` would silently ignore it while an ordinarily-parsed
 * one would not, for a reason that has nothing to do with file order.
 * `rangeRatio`'s own `CLAMP(value, min, max)` still applies on top, exactly
 * as before.
 */
export function resolveRangeValue(props: RangeProperties, orderedKeys: RangeValueOrder): number {
  if (!orderedKeys) {
    const min = props.minValue ?? RANGE_DEFAULT_MIN;
    const max = props.maxValue ?? RANGE_DEFAULT_MAX;
    const page = props.page ?? RANGE_DEFAULT_PAGE;
    return calcValue(props.value ?? RANGE_DEFAULT_VALUE, min, max, page);
  }

  const state: RangeSimState = {
    min: RANGE_DEFAULT_MIN,
    max: RANGE_DEFAULT_MAX,
    page: RANGE_DEFAULT_PAGE,
    val: RANGE_DEFAULT_VALUE,
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
