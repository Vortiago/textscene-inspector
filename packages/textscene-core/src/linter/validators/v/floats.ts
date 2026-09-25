/**
 * Float combinators: a two-sided bounded float, an angle Godot hints in degrees
 * and stores in radians, and the two one-sided shorthands.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { createNumericRangeValidator } from '../commonValidators.js';
import { formatCode, numericRange, valueCode } from './codes.js';
import {
  accepts,
  endSeverity,
  ground,
  maybeFinite,
  maybeNan,
  type FiniteGrounding,
  type Grounding,
} from './grounding.js';
import type { FloatOpts } from './options.js';
import { degToRad } from '../../../godot/index.js';

/**
 * How far past a radian bound a value may sit, a tolerance this repo picks:
 * Godot writes float32 `PI` back as `3.1415927`, above float64 `Math.PI`. Wider
 * than a float32 ULP near PI (~2.4e-7), since a tight bound rejects real scenes.
 * Exported so a slice's own radian ceiling uses the same value.
 */
export const RADIAN_ROUNDTRIP_EPSILON = 0.0001;

export const floatCombinators = {
  /** Float in a range. Either bound is optional. */
  float(name: string, opts: FloatOpts = {}): PropertyValidator {
    return maybeNan(name, opts, maybeFinite(name, opts, ground(
      accepts(
        createNumericRangeValidator({
          propertyName: name,
          min: opts.min ?? null,
          max: opts.max ?? null,
          enforcedMin: opts.enforcedMin,
          enforcedMax: opts.enforcedMax,
          message: opts.message,
          errorCodeFormat: formatCode(name),
          errorCodeValue: valueCode(name),
          minSeverity: endSeverity(opts, 'min'),
          maxSeverity: endSeverity(opts, 'max'),
        }),
        numericRange('float', opts.min, opts.max, opts)
      ),
      opts,
      { min: opts.min, max: opts.max, enforcedMin: opts.enforcedMin, enforcedMax: opts.enforcedMax }
    )));
  },

  /**
   * An angle Godot hints `radians_as_degrees`: the inspector shows degrees, the
   * `.tscn` stores radians. Give the degree bounds from the hint string and this
   * converts them, widened by {@link RADIAN_ROUNDTRIP_EPSILON}.
   *
   * @param name - the property key.
   * @param opts - the hint's degree extents; omit `minDeg` for a one-sided
   *   range such as `"0,180,…"`.
   */
  radians(name: string, opts: { minDeg?: number; maxDeg: number } & Grounding): PropertyValidator {
    const max = degToRad(opts.maxDeg) + RADIAN_ROUNDTRIP_EPSILON;
    const min = opts.minDeg === undefined ? 0 : degToRad(opts.minDeg) - RADIAN_ROUNDTRIP_EPSILON;
    const lowDeg = opts.minDeg ?? 0;
    return ground(
      accepts(
      createNumericRangeValidator({
        propertyName: name,
        min,
        max,
        message: `Property '${name}' must be between ${min.toFixed(4)} and ${max.toFixed(4)} radians (${lowDeg} to ${opts.maxDeg} degrees)`,
        errorCodeFormat: formatCode(name),
        errorCodeValue: valueCode(name),
        minSeverity: endSeverity(opts, 'min'),
        maxSeverity: endSeverity(opts, 'max'),
      }),
      `radians, ${lowDeg}° to ${opts.maxDeg}°`
      ),
      opts,
      { min, max }
    );
  },

  /** `float` with a floor of 0. */
  nonNegativeFloat(name: string, opts: FiniteGrounding = {}): PropertyValidator {
    return floatCombinators.float(name, { ...opts, min: 0 });
  },

  /**
   * Float > 0 (strict), the shape of `ERR_FAIL_COND(p_x <= 0)`: an exclusive
   * setter end at 0, never `Number.MIN_VALUE` in the `min` slot. Pass the hint's
   * own floor as `min`, and the band between the two warns.
   */
  positiveFloat(
    name: string,
    message?: string,
    opts: Grounding & { min?: number } = {}
  ): PropertyValidator {
    const enforcedMin = { at: 0, exclusive: true };
    // The setter's end merged into `opts`, so `endSeverity` derives the tier
    // here the same way it does for every other combinator.
    const grounded = { ...opts, enforcedMin };
    return ground(
      accepts(
        createNumericRangeValidator({
          propertyName: name,
          min: opts.min ?? null,
          enforcedMin,
          enforcedMessage: message ?? `Property '${name}' must be greater than 0`,
          errorCodeFormat: formatCode(name),
          errorCodeValue: valueCode(name),
          minSeverity: endSeverity(grounded, 'min'),
        }),
        numericRange('float', opts.min, undefined, { enforcedMin })
      ),
      grounded,
      { min: opts.min, enforcedMin }
    );
  },
};
