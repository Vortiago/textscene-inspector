/** Shared validator utilities for common property types */

import type { ParseError } from '../../linter/types.js';
import type { PropertyValidator } from '../propertyValidator.js';
import { propertyError } from './propertyError.js';
import { readIntSlot, slotWidth, truncatedInt, unrepresentableInt } from './intSlot.js';
import { parseGodotFloat, type IntWidth } from '../../godot/index.js';

/**
 * The Variant-literal readers, re-exported from their home in `src/godot/`.
 *
 * They live there because that module imports NOTHING, so the renderer's
 * decoders can read a value the way Godot does without pulling this file's
 * diagnostic machinery into the webview bundle. They are re-exported here
 * because the linter is where they are reached for.
 */
export { TSCN_FLOAT_PATTERN_SOURCE, TSCN_FLOAT_RE, parseGodotFloat } from '../../godot/number.js';
export { parseGodotInt, ruleCount, ruleInt, storedFromFloat } from '../../godot/int.js';

/**
 * One capture group of an ALREADY-MATCHED float tuple, as a number.
 *
 * The component grammar and {@link parseGodotFloat} are derived from the same
 * table, so a component the regex matched always reads: the NaN is unreachable,
 * and every comparison against it is false anyway, which is what a validator
 * wants for a component it cannot place on the number line. Use this rather
 * than `parseFloat` wherever a matched component is compared, or `inf` reads as
 * NaN and a bound silently stops applying to it.
 */
export function tupleComponent(text: string | undefined): number {
  return parseGodotFloat(text ?? '') ?? NaN;
}

/**
 * Creates a boolean validator function
 * Validates that a value is either 'true' or 'false'
 */
export function createBooleanValidator(
  propertyName: string,
  errorCode: string = 'INVALID_BOOLEAN_FORMAT'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return propertyError(key, line, `Property '${propertyName}' must be a boolean (true or false), got: "${value}"`, errorCode);
    }
    return null;
  };
}

/**
 * Creates an enum validator for integer enum values
 */
export function createEnumValidator(
  propertyName: string,
  min: number,
  max: number,
  enumValues: Record<number, string>,
  errorCodeFormat: string = 'INVALID_FORMAT',
  errorCodeValue: string = 'INVALID_VALUE',
  /**
   * Severity of the RANGE branch (ADR-0032). The FORMAT branch below stays an
   * error unconditionally: an unparseable value is malformed whatever the
   * engine does with it.
   */
  valueSeverity: ParseError['severity'] = 'error',
  /**
   * Severity of the MAX branch, defaulting to the min's. Separate for the same
   * reason `createNumericRangeValidator` splits them: an enum can have an
   * enforced floor and a merely hinted ceiling, and collapsing the two to a
   * single severity reported an ERROR for a value only the inspector hint
   * excludes.
   */
  maxSeverity: ParseError['severity'] = valueSeverity
): PropertyValidator {
  const validator: PropertyValidator = (key, value, line) => {
    const read = readIntSlot(value, max);
    const num = read.stored;
    if (num === null) {
      return propertyError(key, line, `Property '${propertyName}' must be a number, got: "${value}"`, errorCodeFormat);
    }
    const refused = unrepresentableInt(propertyName, key, value, line, errorCodeValue, num);
    if (refused) return refused;
    if (num < min || num > max) {
      const validValuesStr = Object.entries(enumValues)
        .map(([val, name]) => `${val}=${name}`)
        .join(', ');
      return propertyError(
        key,
        line,
        `Property '${propertyName}' must be ${min}-${max} (got ${num}). Valid values: ${validValuesStr}`,
        errorCodeValue,
        num < min ? valueSeverity : maxSeverity
      );
    }
    return truncatedInt(propertyName, key, value, line, errorCodeValue, read);
  };
  return validator;
}

/**
 * The setter's OWN limit at one end, where it sits outside the hint's.
 *
 * The two are separate tiers and both are reachable, so one slot cannot hold
 * them: `AudioStreamPlayer.pitch_scale` is refused at `<= 0` and hinted from
 * 0.01, and collapsing that to a single floor either errors on 0.005 (a value
 * Godot loads) or says nothing about it (a value the inspector excludes).
 */
export interface EnforcedEnd {
  /** The limit itself. */
  at: number;
  /** `ERR_FAIL_COND(x <= at)` rather than `< at`: the endpoint is refused too. */
  exclusive?: boolean;
}

/** What a numeric range validator checks, and how it reports each end. */
export interface NumericRangeSpec {
  propertyName: string;
  /** Outer floor. Its severity is `minSeverity`, so a hinted one warns. */
  min?: number | null;
  /** Outer ceiling. */
  max?: number | null;
  /**
   * The slot's C++ integer type, where the class declares one.
   *
   * `slotWidth` can only infer `uint32` from a ceiling above `INT32_MAX`, so an
   * unsigned slot whose hint states no such ceiling reads as int32 and refuses
   * values the engine stores. Naming it here is the declaration; the inference
   * stays as the fallback for the slots that do carry the ceiling.
   */
  width?: IntWidth;
  /**
   * The setter's floor, below `min`. Anything under it is an ERROR whatever
   * `minSeverity` says, and the band up to `min` still reports at that tier.
   */
  enforcedMin?: EnforcedEnd;
  /** The setter's ceiling, above `max`. */
  enforcedMax?: EnforcedEnd;
  parseAsInt?: boolean;
  /** Replaces the derived text on the OUTER ends only. */
  message?: string;
  /** Replaces the derived text on the setter's own ends, which state a different reason. */
  enforcedMessage?: string;
  errorCodeFormat?: string;
  errorCodeValue?: string;
  /**
   * Severity of the outer MIN branch; the FORMAT branch stays an error.
   * Separate from the max because a property can have an enforced floor and a
   * merely hinted ceiling (ADR-0032).
   */
  minSeverity?: ParseError['severity'];
  /** Severity of the outer MAX branch. Defaults to the min's. */
  maxSeverity?: ParseError['severity'];
}

/** `must be greater than 3` / `must be at least 3`, per exclusivity. */
function refusalMessage(
  propertyName: string,
  end: EnforcedEnd,
  side: 'min' | 'max',
  num: number
): string {
  const relation =
    side === 'min'
      ? end.exclusive
        ? 'greater than'
        : 'at least'
      : end.exclusive
        ? 'less than'
        : 'at most';
  return `Property '${propertyName}' must be ${relation} ${end.at} (got ${num}); Godot's setter refuses the write.`;
}

/**
 * The setter's refusal at one end, or `null` when the value clears it.
 *
 * Both the comparison and its wording, because separating them is what let a
 * second copy appear: `refusalMessage` was exported so `v.strictInt` could
 * rebuild the `exclusive ? <= : <` test around it, and an exclusive polarity is
 * exactly the thing that is easy to get backwards at a max end.
 */
export function enforcedEndRefusal(
  propertyName: string,
  end: EnforcedEnd | undefined,
  side: 'min' | 'max',
  num: number,
  override?: string
): string | null {
  if (!end) return null;
  const refused =
    side === 'min'
      ? end.exclusive
        ? num <= end.at
        : num < end.at
      : end.exclusive
        ? num >= end.at
        : num > end.at;
  if (!refused) return null;
  return override ?? refusalMessage(propertyName, end, side, num);
}

/** Creates a numeric range validator for float/int values. */
export function createNumericRangeValidator(spec: NumericRangeSpec): PropertyValidator {
  const {
    propertyName,
    min = null,
    max = null,
    enforcedMin,
    enforcedMax,
    parseAsInt = false,
    message: customMessage,
    enforcedMessage,
    errorCodeFormat = 'INVALID_FORMAT',
    errorCodeValue = 'INVALID_VALUE',
    minSeverity: valueSeverity = 'error',
    maxSeverity = valueSeverity,
  } = spec;
  const validator: PropertyValidator = (key, value, line) => {
    // `inf`/`nan` are legal literals in either slot, so the miss signal is null
    // and a parsed NaN falls through to the range checks, which it never trips.
    // `null` in the FLOAT case, and that is the flag the truncation check reads
    // at the end: only an INT slot has a fractional part to drop.
    const read = parseAsInt ? readIntSlot(value, max, spec.width) : null;
    const num = read ? read.stored : parseGodotFloat(value);
    // An INT slot narrows a non-finite at PARSE time to a value the file does
    // not state (see `asStoredInt`), so the literal is ALTERED and reports as
    // an error. A FLOAT slot stores it verbatim and says nothing. That is the
    // whole difference between the two, and it is the engine's own.
    if (parseAsInt) {
      // The SAME width the read used. Classifying at the default int32 while
      // reading at the declared width is what makes an int64 slot's reader
      // limit report as an engine alteration, at the error tier.
      const refused = unrepresentableInt(
        propertyName, key, value, line, errorCodeValue, num, spec.width ?? slotWidth(max)
      );
      if (refused) return refused;
    }
    if (num === null) {
      return propertyError(
        key,
        line,
        `Property '${propertyName}' must be a number, got: "${value}"`,
        errorCodeFormat
      );
    }

    // The setter's own ends first: they are the more severe tier, and the band
    // between them and the hint's ends is what the outer checks below report.
    const refusal =
      enforcedEndRefusal(propertyName, enforcedMin, 'min', num, enforcedMessage) ??
      enforcedEndRefusal(propertyName, enforcedMax, 'max', num, enforcedMessage);
    if (refusal) return propertyError(key, line, refusal, errorCodeValue);

    // Check min constraint
    if (min !== null && num < min) {
      // Pick a default message based on whether one bound or two are set.
      // Two bounds → "must be between X and Y" (matches the wording the
      // per-node linter tests assert). One bound → "must be >= X" or
      // "must be non-negative" (the legacy single-bound wording).
      let defaultMsg: string;
      if (max !== null) {
        defaultMsg = `Property '${propertyName}' must be between ${min} and ${max} (got ${num})`;
      } else if (min === 0) {
        defaultMsg = `Property '${propertyName}' must be non-negative (got ${num})`;
      } else {
        defaultMsg = `Property '${propertyName}' must be >= ${min}, got: ${num}`;
      }
      return propertyError(key, line, customMessage || defaultMsg, errorCodeValue, valueSeverity);
    }

    // Check max constraint
    if (max !== null && num > max) {
      const defaultMsg =
        min !== null
          ? `Property '${propertyName}' must be between ${min} and ${max} (got ${num})`
          : `Property '${propertyName}' must be <= ${max}, got: ${num}`;
      return propertyError(key, line, customMessage || defaultMsg, errorCodeValue, maxSeverity);
    }

    // Last, so a value that is BOTH fractional and out of range reports the
    // error rather than this warning. A FLOAT slot stores `5.5` verbatim and
    // has nothing to say.
    return read ? truncatedInt(propertyName, key, value, line, errorCodeValue, read) : null;
  };
  return validator;
}

/**
 * Creates a validator for positive integers (> 0)
 * Useful for properties that would cause division by zero if set to 0
 */
export function createPositiveIntegerValidator(
  propertyName: string,
  errorMessage?: string,
  errorCodeFormat: string = 'INVALID_FORMAT',
  errorCodeValue: string = 'INVALID_VALUE',
  /** Severity of the RANGE branch; the FORMAT branch stays an error. */
  valueSeverity: ParseError['severity'] = 'error'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    const read = readIntSlot(value);
    const num = read.stored;
    if (num === null) {
      return propertyError(key, line, `Property '${propertyName}' must be a number, got: "${value}"`, errorCodeFormat);
    }
    const refused = unrepresentableInt(propertyName, key, value, line, errorCodeValue, num);
    if (refused) return refused;
    if (num <= 0) {
      const defaultMsg = `Property '${propertyName}' must be greater than 0 (got ${num}). Zero or negative values cause division by zero.`;
      return propertyError(key, line, errorMessage || defaultMsg, errorCodeValue, valueSeverity);
    }
    return truncatedInt(propertyName, key, value, line, errorCodeValue, read);
  };
}
