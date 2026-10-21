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
  if (!Number.isFinite(value)) return formatReal(value);
  return grisuLayout(storedReal(value) === value ? Number(formatReal(value)) : value);
}

/**
 * The decimal exponents `grisu2::to_chars` writes in decimal notation. Outside them it writes
 * scientific notation with a signed exponent of at least two digits (measured with Godot 4.6.3's
 * `var_to_str`, as the local source holds no `thirdparty/grisu2`).
 */
const DECIMAL_EXPONENT_MIN = -4;
const DECIMAL_EXPONENT_MAX = 14;

/** `shortest` holds the fewest digits that read back as the value, which JavaScript also prints. */
function grisuLayout(shortest: number): string {
  const [mantissa, exponentText] = shortest.toExponential().split('e') as [string, string];
  const exponent = Number(exponentText);
  if (exponent >= DECIMAL_EXPONENT_MIN && exponent <= DECIMAL_EXPONENT_MAX) return String(shortest);
  const sign = exponent < 0 ? '-' : '+';
  return `${mantissa}e${sign}${String(Math.abs(exponent)).padStart(2, '0')}`;
}

/** A FLOAT Variant, with `.0` appended to an integral spelling so it stays a float literal (`:2022-2030`). */
export function floatLiteral(value: number): string {
  const text = componentLiteral(value);
  return /^-?inf$|^nan$|[.eE]/.test(text) ? text : `${text}.0`;
}
