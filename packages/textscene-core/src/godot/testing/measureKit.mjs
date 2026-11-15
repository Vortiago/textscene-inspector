/**
 * The helpers every `measure.mjs` shares: the Godot binary it runs, and the rounding that writes a float
 * with only the digits that read back as the same value.
 */

import process from 'node:process';

/**
 * `--godot <path>`, else `godot` on the PATH.
 *
 * @canonical the Godot binary a measure script runs
 */
export function godotBinary() {
  const flag = process.argv.indexOf('--godot');
  return flag === -1 ? 'godot' : process.argv[flag + 1];
}

/**
 * `value` with each number in it kept to `digits` significant digits, through arrays and objects.
 *
 * @canonical round the floats of a Godot capture to the digits that read back the same
 */
export function rounded(value, digits) {
  if (Array.isArray(value)) return value.map((entry) => rounded(entry, digits));
  if (typeof value === 'number') return Number(value.toPrecision(digits));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, rounded(entry, digits)]));
  }
  return value;
}
