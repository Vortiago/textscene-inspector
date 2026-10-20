/**
 * How Godot's text format spells a number (`VariantWriter::write`, `core/variant/variant_parser.cpp`),
 * for a reader that turns another serialisation into that text.
 */

/**
 * `rtos_fix` (`variant_parser.cpp:1985-1999`): zero without its sign, and the shortest float32
 * spelling for a value a float32 holds exactly, so a stored float carries no garbage digits.
 * `String::num_scientific` writes `inf`, `-inf` and `nan` for the non-finite values. JavaScript
 * spells `-0` as `0` already.
 */
export function componentLiteral(value: number): string {
  if (Number.isNaN(value)) return 'nan';
  if (!Number.isFinite(value)) return value > 0 ? 'inf' : '-inf';
  return Math.fround(value) === value ? shortestFloat32(value) : String(value);
}

/** A FLOAT Variant, with `.0` appended to an integral spelling so it stays a float literal (`:2022-2030`). */
export function floatLiteral(value: number): string {
  const text = componentLiteral(value);
  return /^-?inf$|^nan$|[.eE]/.test(text) ? text : `${text}.0`;
}

/** The fewest significant digits that read back as the same float32. Nine always do. */
function shortestFloat32(value: number): string {
  for (let digits = 1; digits < 9; digits++) {
    const text = String(Number(value.toPrecision(digits)));
    if (Math.fround(Number(text)) === value) return text;
  }
  return String(Number(value.toPrecision(9)));
}
