/**
 * How Godot's text format spells a number (`VariantWriter::write`, `core/variant/variant_parser.cpp`),
 * for a reader that turns another serialisation into that text.
 */

import { formatReal, storedReal } from '../math/real.js';

/**
 * `rtos_fix` (`variant_parser.cpp:1985-1999`): zero without its sign, and the shortest float32
 * spelling for a value a float32 holds exactly, so a stored float carries no garbage digits.
 * `String::num_scientific` writes `inf`, `-inf` and `nan` for the non-finite values. JavaScript
 * spells `-0` as `0` already.
 */
export function componentLiteral(value: number): string {
  return Number.isFinite(value) && storedReal(value) !== value ? String(value) : formatReal(value);
}

/** A FLOAT Variant, with `.0` appended to an integral spelling so it stays a float literal (`:2022-2030`). */
export function floatLiteral(value: number): string {
  const text = componentLiteral(value);
  return /^-?inf$|^nan$|[.eE]/.test(text) ? text : `${text}.0`;
}
