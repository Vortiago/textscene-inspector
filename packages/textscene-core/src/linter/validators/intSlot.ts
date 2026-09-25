/**
 * The INT-slot verdicts, shared by every combinator that reads one.
 * `parseGodotInt` returns `null` for text the tokenizer cannot read and `NaN`
 * for a literal that reads but the slot cannot hold, and NaN fails every
 * comparison, so each combinator gates both.
 */

import type { ParseError } from '../types.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';
import { propertyError } from './propertyError.js';
import {
  INT32_MAX,
  parseGodotFloat,
  readerLimitedInt,
  storedFromFloat,
  type IntWidth,
  boolLiteralAsNumber,
} from '../../godot/index.js';

/**
 * `_to_int<T>` (`variant.h:360-377`): the conversion every int slot's write
 * goes through, and the authority for refusing a literal it cannot carry.
 */
const INT_SLOT_CITE = 'variant.h:360-377';

/**
 * Error for a value that read but cannot be stored; `null` for a usable number.
 * It never names the result: the FLOAT branch (`variant.h:369-370`) is undefined
 * behaviour, so on x86_64 `light_mask = 3e9` stores -2147483648 where `3000000000`
 * stores -1294967296. The message quotes the literal instead.
 */
export function unrepresentableInt(
  propertyName: string,
  key: string,
  value: string,
  line: number,
  errorCodeValue: string,
  num: number | null,
  width: IntWidth = 'int32'
): ParseError | null {
  if (num === null || !Number.isNaN(num)) return null;
  // Past 2^53 an int64 slot still holds the value exactly, so the limit is this
  // reader's and only warns. It is not silence: the caller reads NaN as
  // "already reported". At narrower widths the engine alters the value, an error.
  const beyondReader = readerLimitedInt(parseGodotFloat(value) ?? NaN, width);
  if (beyondReader) {
    return propertyError(
      key,
      line,
      `Property '${propertyName}' is outside the range this linter reads exactly, got: "${value}". ` +
        `An int64 slot holds it and Godot stores what the file states; no bound on this value is checked here.`,
      errorCodeValue,
      'warning'
    );
  }
  return propertyError(
    key,
    line,
    `Property '${propertyName}' cannot be stored in an integer slot, got: "${value}". ` +
      `The file loads, but the value Godot stores is not the one the file states.`,
    errorCodeValue,
    'error'
  );
}

/**
 * The width a slot reads at, from its own declared ceiling: a maximum above
 * int32 is unreachable unless the slot is unsigned. `MeshInstance3D.layers =
 * 4294967295` stores 4294967295 (uint32), and `Node2D.light_mask` stores -1 (int32).
 */
export function slotWidth(max?: number | null): IntWidth {
  return (max ?? 0) > INT32_MAX ? 'uint32' : 'int32';
}

/**
 * Both readings of one literal, from one parse: what the slot stores, and the
 * double it came from, which the truncation check needs. `badIntElement` has
 * the same shape for an array element.
 */
export interface IntSlotRead {
  /** The tokenizer's double, or `null` for text outside the grammar. */
  readonly asFloat: number | null;
  /** The integer stored: `null` unreadable, `NaN` read but unstorable. */
  readonly stored: number | null;
}

/**
 * A literal as an {@link IntSlotRead}: the integer this slot stores, beside the
 * double it came from.
 * The width goes in, not onto the result: `_to_int`'s FLOAT branch is undefined
 * outside the target type's range, so a uint32 `seed = 4294967295.0` is legal.
 */
export function readIntSlot(value: string, max?: number | null, width?: IntWidth): IntSlotRead {
  const asFloat = boolLiteralAsNumber(value) ?? parseGodotFloat(value);
  if (asFloat === null) return { asFloat: null, stored: null };
  return { asFloat, stored: storedFromFloat(asFloat, value, width ?? slotWidth(max)) };
}

/**
 * Tag a validator as reading an INT slot: the population `nonFiniteInts.test.ts`
 * sweeps by tag, not by `accepts` prose, which `layerBitmask` overwrites. `width`
 * is the slot's C++ type, since `4294967296` is unstorable in int32 and exact in int64.
 */
export function markIntSlot<T extends PropertyValidator>(
  validator: T,
  width: IntWidth = 'int32'
): T {
  // Never format-only: `inf` reads (`variant_parser.cpp:701-707`) and is altered
  // on the write.
  delete validator.formatOnly;
  // Not `grounding`, which says where a bound's authority comes from:
  // `validatorClassification` accepts `intSlot` only for a validator with no bounds.
  validator.intSlot = { cite: INT_SLOT_CITE, width };
  return validator;
}

/**
 * A cross-family spelling warning: the value is stored, but not as written, so a
 * re-save rewrites the line. A warning, as {@link storedNotWritten} is:
 * `can_convert_strict` accepts the whole BOOL/INT/FLOAT family
 * (`variant.cpp:550-583`). The int half is folded into {@link storedNotWritten}.
 */
export function convertedSpelling(
  propertyName: string,
  key: string,
  value: string,
  line: number,
  code: string,
  storedText: string,
  converted: boolean
): ParseError | null {
  if (!converted) return null;
  return propertyError(
    key,
    line,
    `Property '${propertyName}' is written "${value.trim()}", which this slot converts: ` +
      `Godot stores ${storedText} and writes it back that way.`,
    code,
    'warning'
  );
}

/**
 * The warning for a literal an INT slot stores as something else, or `null`.
 * `_to_int` (`variant.h:361-377`) maps a BOOL to 1/0 and truncates a FLOAT, so
 * `cast_shadow = true` stores 1 and `hframes = 5.5` stores 5. Every int reader
 * applies it last, after every bound, since an out-of-range error outranks it.
 */
export function storedNotWritten(
  propertyName: string,
  key: string,
  value: string,
  line: number,
  errorCodeValue: string,
  read: IntSlotRead
): ParseError | null {
  // The caller's read, so the literal is parsed once.
  const { asFloat, stored } = read;
  if (stored === null || Number.isNaN(stored)) return null;
  // The BOOL arm first: `true` reads as a whole 1, so the fractional test below
  // returns null past it and the conversion would go unreported.
  const converted = convertedSpelling(
    propertyName, key, value, line, errorCodeValue, String(stored),
    boolLiteralAsNumber(value) !== undefined
  );
  if (converted) return converted;
  if (asFloat === null || Number.isInteger(asFloat)) return null;
  // A warning, not an error: the conversion (`variant.h:369-370`) happens before
  // the setter, which only sees the 5. A `_VALUE` code, never `_FORMAT`: the
  // tokenizer reads `5.5` (`variant_parser.cpp:443-448` types it FLOAT).
  return propertyError(
    key,
    line,
    `Property '${propertyName}' is an integer slot, so Godot drops the fractional part of "${value}" and stores ${stored}.`,
    errorCodeValue,
    'warning'
  );
}

/**
 * {@link storedNotWritten} for the components of an integer composite:
 * `_parse_construct<int32_t>` (`variant_parser.cpp:577-592`) narrows any number
 * token, so `Vector2i(1.5, 2)` stores `(1, 2)`. Its callers' widened grammar
 * admits `inf`/`nan`, so it guards finiteness itself.
 */
export function truncatedComponent(
  propertyName: string,
  key: string,
  line: number,
  components: readonly (string | undefined)[],
  errorCodeValue: string
): ParseError | null {
  for (const text of components) {
    if (text === undefined) continue;
    const asFloat = parseGodotFloat(text);
    // `Number.isFinite` first: `Number.isInteger` is false for Infinity and NaN,
    // and ADR-0032 forbids naming an undefined conversion's result. A non-finite
    // component is the unstorable refusal, reported by the caller's own arm.
    if (asFloat === null || !Number.isFinite(asFloat) || Number.isInteger(asFloat)) continue;
    return propertyError(
      key,
      line,
      `Property '${propertyName}' has integer components, so Godot drops the fractional part of "${text.trim()}" and stores ${Math.trunc(asFloat)}.`,
      errorCodeValue,
      'warning'
    );
  }
  return null;
}
