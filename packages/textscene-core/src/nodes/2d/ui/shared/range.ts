/**
 * Shared Range base for the Control slices whose geometry is driven by a value
 * inside `[min_value, max_value]` (the sliders today). `Range` is Godot's
 * abstract base class, so its properties and its ratio formula live ONCE here —
 * the `shared/boxContainer.ts` pattern for a slice family. Pure `.ts` (no
 * React/THREE) so parsers can import it inside the linter graph.
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
   * overrides it to 1.0. Purely an input concern — a static preview draws the
   * authored `value` whether or not it is a multiple of `step`.
   */
  step?: number;
  /** `exp_edit`: distribute `value` logarithmically across the range. */
  expEdit?: boolean;
}

/** Godot `Range` property defaults (doc/classes/Range.xml). */
export const RANGE_DEFAULT_VALUE = 0;
export const RANGE_DEFAULT_MIN = 0;
export const RANGE_DEFAULT_MAX = 100;

/** Parse the `Range` properties out of a node's raw property map. */
export function parseRange(properties: Record<string, string>): RangeProperties {
  return {
    value: parseOptionalFloat(properties.value),
    minValue: parseOptionalFloat(properties.min_value),
    maxValue: parseOptionalFloat(properties.max_value),
    step: parseOptionalFloat(properties.step),
    expEdit: parseOptionalBool(properties.exp_edit),
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

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
 */
export function rangeRatio(props: RangeProperties): number {
  const min = props.minValue ?? RANGE_DEFAULT_MIN;
  const max = props.maxValue ?? RANGE_DEFAULT_MAX;
  const raw = props.value ?? RANGE_DEFAULT_VALUE;

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
