/**
 * The INT-slot refusal, shared by every combinator that reads one.
 *
 * `parseGodotInt` returns `null` for text the tokenizer cannot read and `NaN`
 * for a literal that reads but does not fit. Only the first was ever gated, and
 * NaN fails every comparison, so 308 of 542 int slots said nothing.
 */

import type { ParseError } from '../types.js';
import { propertyError } from './propertyError.js';

/**
 * Error for a value that read but cannot be stored; `null` for a usable number.
 *
 * Never names the result: float->int32 is UB and architecture-specific (x86
 * `cvttsd2si` gives INT32_MIN, AArch64 `fcvtzs` saturates the other way). The
 * alteration is the portable claim, so the message quotes the literal instead.
 * `inf`/`-inf`/`inf_neg`/`nan` all READ (variant_parser.cpp:701-707); measured
 * on 4.6.3, `cast_shadow = inf` stores 0 against a default of 1.
 */
export function unrepresentableInt(
  propertyName: string,
  key: string,
  value: string,
  line: number,
  errorCodeValue: string,
  num: number | null
): ParseError | null {
  if (num === null || !Number.isNaN(num)) return null;
  return propertyError(
    key,
    line,
    `Property '${propertyName}' cannot be stored in an integer slot, got: "${value}". ` +
      `The file loads, but the value Godot stores is not the one the file states.`,
    errorCodeValue,
    'error'
  );
}
