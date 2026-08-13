/**
 * Integer combinators, including the enum one.
 *
 * Three of them differ only in how strict the PARSE is, and the difference is
 * deliberate per property: `int` goes through the shared numeric validator,
 * `lenientInt` follows `parseInt`'s tolerance for a trailing decimal, and
 * `strictInt` refuses `5.5` outright.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { propertyError } from '../propertyError.js';
import {
  createEnumValidator,
  createNumericRangeValidator,
  createPositiveIntegerValidator,
  parseGodotFloat,
  parseGodotInt,
  TSCN_FLOAT_RE,
} from '../commonValidators.js';
import { formatCode, numericRange, valueCode } from './codes.js';
import { accepts, endSeverity, ground, shape, type Grounding } from './grounding.js';
import type { IntOpts } from './options.js';

export const integerCombinators = {
  /** Integer in a range, parsed as base 10. */
  int(name: string, opts: IntOpts = {}): PropertyValidator {
    return ground(
      accepts(
        createNumericRangeValidator({
          propertyName: name,
          min: opts.min ?? null,
          max: opts.max ?? null,
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
    );
  },

  /** Positive integer (> 0). Specialised wrapper from `commonValidators`. */
  positiveInt(name: string, message?: string, opts: Grounding = {}): PropertyValidator {
    return ground(
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
    );
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
    return ground(
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
    );
  },

  /**
   * Lenient integer — a float literal in the slot is accepted and truncated
   * ("10.5" → 10), which is what Godot does on assignment to a `Variant::INT`.
   * Used for properties like Camera2D's `limit_*`. The "must be an integer"
   * wording follows the per-node test wording.
   */
  lenientInt(name: string): PropertyValidator {
    const formatErr = formatCode(name);
    return shape(
      (key, value, line) => {
      if (parseGodotInt(value) === null) {
        return propertyError(key, line, `Property '${name}' must be an integer, got: "${value}"`, formatErr);
      }
      return null;
    },
      'integer'
    );
  },

  /**
   * Strict integer — rejects floats that round to an integer (uses
   * `Number.isInteger(parseFloat(value))` to disambiguate "5.5" from "5").
   * Use this when the property is a discrete index/count, not a number
   * that happens to be whole-valued.
   */
  strictInt(name: string, opts: IntOpts = {}): PropertyValidator {
    const formatErr = formatCode(name);
    const valueErr = valueCode(name);
    const { min, max } = opts;
    return ground(accepts((key, value, line) => {
      // `parseGodotFloat` behind the anchored grammar, not `parseFloat`, which
      // reads `8abc` as 8 and admits a literal Godot's parser cannot.
      const parsed = parseGodotFloat(value.trim());
      // Whole-valued OR non-finite. `inf` and `nan` are identifiers `stor_fix`
      // (variant_parser.cpp:149-159) resolves for any slot, so the file loads;
      // `Number.isInteger` is false for both and would report a format error on
      // a literal `v.int` accepts, which is a split no engine line supports.
      if (
        !TSCN_FLOAT_RE.test(value.trim()) ||
        parsed === null ||
        !(Number.isInteger(parsed) || !Number.isFinite(parsed))
      ) {
        return propertyError(key, line, `Property '${name}' must be an integer, got: "${value}"`, formatErr);
      }
      const belowMin = min !== undefined && parsed < min;
      const aboveMax = max !== undefined && parsed > max;
      if (belowMin || aboveMax) {
        return propertyError(
          key,
          line,
          opts.message ?? `Property '${name}' must be ${numericRange('integer', min, max)} (got ${parsed})`,
          valueErr,
          endSeverity(opts, belowMin ? 'min' : 'max')
        );
      }
      return null;
    }, numericRange('integer', min, max)), opts, { min, max });
  },

  /**
   * Strict non-negative integer: same format check as `strictInt`, plus
   * `value >= 0`. Used for frame indices and similar count-style
   * properties where `"5.5"` is a format error and `-1` is a value error.
   */
  strictNonNegativeInt(name: string, opts: Grounding = {}): PropertyValidator {
    const formatErr = formatCode(name);
    const valueErr = valueCode(name);
    const severity = endSeverity(opts, 'min');
    return ground(
      accepts(
        (key, value, line) => {
          const parsed = parseGodotFloat(value.trim());
          if (!TSCN_FLOAT_RE.test(value.trim()) || parsed === null || !Number.isInteger(parsed)) {
            return propertyError(key, line, `Property '${name}' must be an integer, got: "${value}"`, formatErr);
          }
          if (parsed < 0) {
            return propertyError(key, line, `Property '${name}' must be non-negative (got ${parsed})`, valueErr, severity);
          }
          return null;
        },
        'integer >= 0'
      ),
      opts,
      { min: 0 }
    );
  },
};
