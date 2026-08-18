/**
 * Integer combinators, including the enum one.
 *
 * They no longer differ on how strict the PARSE is. One engine behaviour gets
 * one verdict: `_to_int` truncates a fractional literal, and every int slot
 * says so with the same warning, after its own bounds. `strictInt` earns its
 * name on a different axis — it judges the NARROWED int, which is what a
 * setter's `ERR_FAIL_INDEX` receives — and `lenientInt` is just a bound-free
 * `int`.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { propertyError } from '../propertyError.js';
import { markIntSlot, readIntSlot, slotWidth, truncatedInt, unrepresentableInt } from '../intSlot.js';
import {
  createEnumValidator,
  createNumericRangeValidator,
  createPositiveIntegerValidator,
  parseGodotFloat,
  enforcedEndRefusal,
} from '../commonValidators.js';
import { storedFromFloat, type IntWidth } from '../../../godot/index.js';
import type { ParseError } from '../../types.js';
import { formatCode, numericRange, valueCode } from './codes.js';
import { accepts, endSeverity, ground, shape, type Grounding } from './grounding.js';
import type { IntOpts } from './options.js';

/**
 * The format-and-storability gate `strictInt` and `strictNonNegativeInt` share.
 *
 * Returns the stored int32, or the diagnostic that stops the caller. It exists
 * because the two combinators carried a verbatim copy of it — and this round
 * had to make the same two edits by hand in both.
 *
 * `parsed === null` already implies the grammar failed: `parseGodotFloat`
 * returns non-null only for a non-finite spelling or for text that passed
 * `TSCN_FLOAT_RE` itself, so the separate pre-test was a second trim and a
 * second regex run per call.
 */
function storedStrictInt(
  name: string,
  key: string,
  value: string,
  line: number,
  codes: { format: string; value: string },
  max: number | undefined,
  width?: IntWidth
): { stored: number; asFloat: number } | { error: ParseError } {
  const parsed = parseGodotFloat(value);
  // Text outside the grammar is the only FORMAT failure here. A fractional
  // literal used to be one too, which reported a file Godot opens as
  // unparseable — and did so on only 56 of 225 int slots, so the same engine
  // line gave opposite verdicts on Sprite2D and Sprite3D. It is now the
  // truncation WARNING every int slot shares, applied after the bounds below.
  if (parsed === null) {
    return {
      error: propertyError(key, line, `Property '${name}' must be an integer, got: "${value}"`, codes.format),
    };
  }
  const stored = storedFromFloat(parsed, value, width ?? slotWidth(max));
  const unfit = unrepresentableInt(name, key, value, line, codes.value, stored);
  // The float goes back out with the int: the truncation check needs the value
  // the narrowing started from, and re-reading the text for it parsed every
  // clean literal twice.
  return unfit ? { error: unfit } : { stored, asFloat: parsed };
}

export const integerCombinators = {
  /** Integer in a range, parsed as base 10. */
  int(name: string, opts: IntOpts = {}): PropertyValidator {
    // ONE declaration for the read and the tag. They used to be derived
    // separately — `slotWidth(max)` for the read, a defaulted `'int32'` for the
    // tag — and disagreed on every slot whose ceiling exceeds INT32_MAX.
    const width = opts.width ?? slotWidth(opts.max);
    return markIntSlot(ground(
      accepts(
        createNumericRangeValidator({
          propertyName: name,
          min: opts.min ?? null,
          max: opts.max ?? null,
          width,
          enforcedMin: opts.enforcedMin,
          enforcedMax: opts.enforcedMax,
          parseAsInt: true,
          message: opts.message,
          errorCodeFormat: formatCode(name),
          errorCodeValue: valueCode(name),
          minSeverity: endSeverity(opts, 'min'),
          maxSeverity: endSeverity(opts, 'max'),
        }),
        numericRange('integer', opts.min, opts.max, opts)
      ),
      opts,
      { min: opts.min, max: opts.max, enforcedMin: opts.enforcedMin, enforcedMax: opts.enforcedMax }
    ), width);
  },

  /** Positive integer (> 0). Specialised wrapper from `commonValidators`. */
  positiveInt(name: string, message?: string, opts: Grounding = {}): PropertyValidator {
    return markIntSlot(ground(
      accepts(
        createPositiveIntegerValidator(
          name,
          message,
          formatCode(name),
          valueCode(name),
          endSeverity(opts, 'min')
        ),
        'integer > 0'
      ),
      opts,
      { min: 1 }
    ));
  },

  /** Integer enum, e.g. `v.enumInt('cast_shadow', 0, 3, {0:'OFF', 1:'ON', 2:'DOUBLE_SIDED', 3:'SHADOWS_ONLY'})`. */
  enumInt(
    name: string,
    min: number,
    max: number,
    labels: Record<number, string>,
    opts: Grounding = {}
  ): PropertyValidator {
    // The labels are the point: `enum 0-3 (OFF/ON/DOUBLE_SIDED/SHADOWS_ONLY)`
    // tells a reader what each number means without opening Godot's docs.
    // Integer-like keys already iterate ascending, so no sort is needed.
    const names = Object.values(labels).join('/');
    return markIntSlot(ground(
      accepts(
        createEnumValidator(
          name,
          min,
          max,
          labels,
          formatCode(name),
          valueCode(name),
          endSeverity(opts, 'min'),
          endSeverity(opts, 'max')
        ),
        `enum ${min}-${max} (${names})`
      ),
      opts,
      { min, max }
    ));
  },

  /**
   * Unbounded integer. Identical in behaviour to a bound-free `int`; kept as a
   * separate name only where a slice reads better for it.
   */
  lenientInt(name: string): PropertyValidator {
    const formatErr = formatCode(name);
    return markIntSlot(shape(
      (key, value, line) => {
      const read = readIntSlot(value);
      if (read.stored === null) {
        return propertyError(key, line, `Property '${name}' must be an integer, got: "${value}"`, formatErr);
      }
      return (
        unrepresentableInt(name, key, value, line, valueCode(name), read.stored) ??
        truncatedInt(name, key, value, line, valueCode(name), read)
      );
    },
      'integer'
    ));
  },

  /**
   * Integer judged as the STORED int32 rather than the raw double, which is
   * what a setter's own `ERR_FAIL_INDEX` sees.
   *
   * No longer "strict" about a fractional literal: that is the truncation
   * warning every int slot shares. The name is kept because the read is
   * genuinely different from `int`'s — it narrows before the bound check, so
   * `frame = 4294967295` is judged as the -1 the guard receives.
   */
  strictInt(name: string, opts: IntOpts = {}): PropertyValidator {
    const formatErr = formatCode(name);
    const valueErr = valueCode(name);
    const { min, max, enforcedMin, enforcedMax } = opts;
    const width = opts.width ?? slotWidth(max);
    return markIntSlot(ground(accepts((key, value, line) => {
      // The STORED int32, not the raw double: the setter's guard sees what
      // `_to_int` handed it, so `frame = 4294967295` is -1 to its ERR_FAIL_INDEX
      // and must be judged as -1.
      const read = storedStrictInt(name, key, value, line, { format: formatErr, value: valueErr }, max, width);
      if ('error' in read) return read.error;
      const { stored } = read;
      // The setter's own ends first: they are the more severe tier, and the
      // band between a setter end and the hint's still reports at the hint's.
      // `IntOpts` has always ACCEPTED these two, and this combinator dropped
      // them on the floor — a citation written and never read.
      const refusal =
        enforcedEndRefusal(name, enforcedMin, 'min', stored) ??
        enforcedEndRefusal(name, enforcedMax, 'max', stored);
      if (refusal) return propertyError(key, line, refusal, valueErr);
      const belowMin = min !== undefined && stored < min;
      const aboveMax = max !== undefined && stored > max;
      if (belowMin || aboveMax) {
        return propertyError(
          key,
          line,
          opts.message ?? `Property '${name}' must be ${numericRange('integer', min, max)} (got ${stored})`,
          valueErr,
          endSeverity(opts, belowMin ? 'min' : 'max')
        );
      }
      return truncatedInt(name, key, value, line, valueErr, read);
    }, numericRange('integer', min, max, opts)), opts, { min, max, enforcedMin, enforcedMax }), width);
  },

  /**
   * {@link strictInt} plus `value >= 0`, for frame indices and similar counts
   * where `-1` is a value error.
   */
  strictNonNegativeInt(name: string, opts: Grounding = {}): PropertyValidator {
    const formatErr = formatCode(name);
    const valueErr = valueCode(name);
    const severity = endSeverity(opts, 'min');
    return markIntSlot(ground(
      accepts(
        (key, value, line) => {
          const read = storedStrictInt(
            name, key, value, line, { format: formatErr, value: valueErr }, undefined
          );
          if ('error' in read) return read.error;
          const { stored } = read;
          if (stored < 0) {
            return propertyError(key, line, `Property '${name}' must be non-negative (got ${stored})`, valueErr, severity);
          }
          return truncatedInt(name, key, value, line, valueErr, read);
        },
        'integer >= 0'
      ),
      opts,
      { min: 0 }
    ));
  },
};
