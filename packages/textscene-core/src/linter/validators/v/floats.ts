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
 * How far past a radian bound a value may sit before it is out of range.
 *
 * Not an engine constant — a tolerance this repo picks. Godot stores these
 * properties as float32 and writes them back in decimal, so a value the editor
 * set to exactly `PI` or exactly `PI/2` reloads a hair off, and a bound derived
 * from JavaScript's float64 `Math.PI` would reject the number Godot's own
 * serialiser produced. Comfortably wider than a float32 ULP near PI (~2.4e-7),
 * because the cost of being generous here is missing an absurd value nobody
 * writes, while the cost of being tight is rejecting real scenes.
 *
 * Exported because `v.radians` sets the convention and other bounds have to
 * match it: a slice comparing against a radian ceiling of its own is
 * compensating for exactly this, and typing `0.0001` again is how the two
 * drift apart.
 */
export const RADIAN_ROUNDTRIP_EPSILON = 0.0001;

export const floatCombinators = {
  /**
   * Float in a range. Either bound is optional.
   * Default `min = null` (no lower bound), `max = null` (no upper bound).
   */
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
   * `.tscn` stores radians. Give the DEGREE bounds from the hint string and this
   * converts them, so the literal in the slice matches the literal in the `.cpp`.
   *
   * The epsilon absorbs float round-trip: Godot writes `3.1415927`, and a bare
   * `<= Math.PI` comparison rejects a value the engine itself produced.
   *
   * Five slices hand-rolled this constant and three hand-wrote the message
   * before it existed, and two agents in one wave independently extracted the
   * same helper, which is what a missing combinator looks like.
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
   * Float > 0 (strict), the shape of `ERR_FAIL_COND(p_x <= 0)`.
   *
   * An EXCLUSIVE end at 0 rather than an inclusive one at `Number.MIN_VALUE`.
   * The old spelling was a fiction that happened to behave: no positive double
   * sits below `MIN_VALUE`, so it read the same, but it occupied the `min` slot
   * with a number no engine line states. That made the hint-parity ledger see a
   * floor where the hint's floor was still unimplemented, and it needed a
   * per-property exemption roster to stay quiet about it.
   *
   * Pass the hint's own floor as `min` where the property has one — the same
   * slot every other combinator uses for it — and the band between the two
   * reports as a warning instead of vanishing.
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
