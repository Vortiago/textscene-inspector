/** Boolean, enum and numeric-range validator factories, shared by every slice. */

import type { ParseError } from '../../linter/types.js';
import type { PropertyValidator } from '../propertyValidator.js';
import { propertyError } from './propertyError.js';
import {
  convertedSpelling,
  readIntSlot,
  slotWidth,
  storedNotWritten,
  unrepresentableInt,
} from './intSlot.js';
import {
  boolLiteralAsNumber,
  boolSlotValue,
  parseGodotFloat,
  type IntWidth,
} from '../../godot/index.js';

/**
 * The Variant-literal readers, re-exported from `src/godot/`. They live there
 * because that module imports nothing, so the renderer can read a value as
 * Godot does without pulling diagnostics into the webview bundle.
 */
export { TSCN_FLOAT_PATTERN_SOURCE, TSCN_FLOAT_RE, parseGodotFloat } from '../../godot/number.js';
export { parseGodotInt, ruleCount, ruleInt, storedFromFloat } from '../../godot/int.js';

/**
 * One capture group of an already-matched float tuple, as a number. The regex
 * and {@link parseGodotFloat} share one grammar, so the NaN fallback is
 * unreachable. Use this, not `parseFloat`, which reads `inf` as NaN and
 * silently drops a bound.
 */
export function tupleComponent(text: string | undefined): number {
  return parseGodotFloat(text ?? '') ?? NaN;
}

/** A validator that accepts a boolean literal. */
export function createBooleanValidator(
  propertyName: string,
  errorCode: string = 'INVALID_BOOLEAN_FORMAT'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    const stored = boolSlotValue(value);
    if (stored === undefined) {
      return propertyError(key, line, `Property '${propertyName}' must be a boolean (true or false), got: "${value}"`, errorCode);
    }
    return convertedSpelling(
      propertyName, key, value, line, errorCode, String(stored),
      boolLiteralAsNumber(value) === undefined
    );
  };
}

/** A validator for an integer enum. */
export function createEnumValidator(
  propertyName: string,
  min: number,
  max: number,
  enumValues: Record<number, string>,
  errorCodeFormat: string = 'INVALID_FORMAT',
  errorCodeValue: string = 'INVALID_VALUE',
  /**
   * Severity of the range branch (ADR-0032). The format branch always errors:
   * an unparseable value is malformed whatever the engine does with it.
   */
  valueSeverity: ParseError['severity'] = 'error',
  /**
   * Severity of the max branch, defaulting to the min's: an enum can have an
   * enforced floor and a hinted ceiling.
   */
  maxSeverity: ParseError['severity'] = valueSeverity,
  /**
   * Exactly which values are in range, where the enum is not contiguous: a
   * `PROPERTY_HINT_ENUM` label can carry its own `:value`, so PopupMenu offers
   * ids 0 and 2-5. min/max stay the reported band's ends.
   */
  allowed?: ReadonlySet<number>,
  /**
   * The setter's own ends, where they sit outside the hint's: `Button.text_direction`
   * hints 0-3 and its `ERR_FAIL_COND` refuses only below -1, so -1 warns from
   * `min` instead of erroring.
   */
  enforcedMin?: EnforcedEnd,
  enforcedMax?: EnforcedEnd
): PropertyValidator {
  const validator: PropertyValidator = (key, value, line) => {
    const read = readIntSlot(value, max);
    const num = read.stored;
    if (num === null) {
      return propertyError(key, line, `Property '${propertyName}' must be a number, got: "${value}"`, errorCodeFormat);
    }
    const refused = unrepresentableInt(propertyName, key, value, line, errorCodeValue, num);
    if (refused) return refused;
    // The setter's ends first: they are the more severe tier, and the band
    // between them and the hint's ends is what the membership test reports.
    const refusal =
      enforcedEndRefusal(propertyName, enforcedMin, 'min', num) ??
      enforcedEndRefusal(propertyName, enforcedMax, 'max', num);
    if (refusal) return propertyError(key, line, refusal, errorCodeValue);
    const outOfBand = allowed
      ? !allowed.has(num)
      : num < min || num > max;
    if (outOfBand) {
      // Only the constants the bound accepts: `enumValues` is the engine's whole
      // enum, and min/max the window this class's hint opens onto it
      // (`Button.alignment` offers 0-2 of a 0-3 enum).
      const validValuesStr = Object.entries(enumValues)
        .filter(([val]) => (allowed ? allowed.has(Number(val)) : Number(val) >= min && Number(val) <= max))
        .map(([val, name]) => `${val}=${name}`)
        .join(', ');
      const band = allowed ? [...allowed].join('/') : `${min}-${max}`;
      return propertyError(
        key,
        line,
        `Property '${propertyName}' must be ${band} (got ${num}). Valid values: ${validValuesStr}`,
        errorCodeValue,
        num < min ? valueSeverity : maxSeverity
      );
    }
    return storedNotWritten(propertyName, key, value, line, errorCodeValue, read);
  };
  return validator;
}

/**
 * The setter's own limit at one end, where it sits outside the hint's. Both
 * tiers are reachable: `AudioStreamPlayer.pitch_scale` is refused at `<= 0` and
 * hinted from 0.01, so 0.005 loads but warns.
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
   * The slot's C++ integer type, where the class declares one. `slotWidth`
   * infers `uint32` only from a ceiling above `INT32_MAX`, so an unsigned slot
   * without that ceiling needs this declaration.
   */
  width?: IntWidth;
  /**
   * The setter's floor, below `min`. Anything under it errors whatever
   * `minSeverity` says, and the band up to `min` still reports at that tier.
   */
  enforcedMin?: EnforcedEnd;
  /** The setter's ceiling, above `max`. */
  enforcedMax?: EnforcedEnd;
  parseAsInt?: boolean;
  /** Replaces the derived text on the outer ends only. */
  message?: string;
  /** Replaces the derived text on the setter's own ends, which state a different reason. */
  enforcedMessage?: string;
  errorCodeFormat?: string;
  errorCodeValue?: string;
  /**
   * Severity of the outer min branch; the format branch stays an error.
   * Separate from the max because a property can have an enforced floor and a
   * hinted ceiling (ADR-0032).
   */
  minSeverity?: ParseError['severity'];
  /** Severity of the outer max branch. Defaults to the min's. */
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
  // Not "refuses the write": the enforced tier covers a setter that alters the
  // value, such as a CLAMP (range.cpp:255) or a MAX (material.cpp:3087), as
  // well as one that drops it. This sentence is true of both.
  return `Property '${propertyName}' must be ${relation} ${end.at} (got ${num}); Godot does not store this value.`;
}

/**
 * The setter's refusal at one end, or `null` when the value clears it. The
 * comparison and its wording live together, since an exclusive polarity is
 * easy to get backwards at a max end.
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
    // `inf`/`nan` are legal in either slot, so a parsed NaN falls through to
    // the range checks, which it never trips. `read` is null for a float slot,
    // and the truncation check at the end reads that flag.
    const read = parseAsInt ? readIntSlot(value, max, spec.width) : null;
    const num = read ? read.stored : boolLiteralAsNumber(value) ?? parseGodotFloat(value);
    // An int slot narrows a non-finite at parse time to a value the file does
    // not state (see `asStoredInt`), so it errors. A float slot stores it
    // verbatim and says nothing, as the engine does.
    if (parseAsInt) {
      // The same width the read used, or an int64 slot's reader limit reports
      // as an engine alteration.
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

    if (min !== null && num < min) {
      // The per-node linter tests assert this wording.
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

    if (max !== null && num > max) {
      const defaultMsg =
        min !== null
          ? `Property '${propertyName}' must be between ${min} and ${max} (got ${num})`
          : `Property '${propertyName}' must be <= ${max}, got: ${num}`;
      return propertyError(key, line, customMessage || defaultMsg, errorCodeValue, maxSeverity);
    }

    // Last, so a value both stored differently and out of range reports the
    // error. A float slot stores `5.5` verbatim but converts a BOOL as an int
    // slot does (`_to_float`, `variant.h:361-377`), so it reports that alone.
    return read
      ? storedNotWritten(propertyName, key, value, line, errorCodeValue, read)
      : convertedSpelling(
          propertyName, key, value, line, errorCodeValue, String(num),
          boolLiteralAsNumber(value) !== undefined
        );
  };
  return validator;
}

