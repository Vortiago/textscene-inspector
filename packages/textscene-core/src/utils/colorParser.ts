/**
 * Parses Godot Color format to three.js hex color.
 */

import { COLOR_RE } from '../parser/vectors';
import { matchedFloat, allFinite } from '../godot/number.js';

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Parse Color from Godot format: `Color(r, g, b, a)`. Values are 0-1, but
 * negatives and values > 1 are accepted. Returns `undefined` when absent or
 * when the grammar does not match — the optional reader that callers who want
 * to SKIP a malformed color (rather than substitute white) build on.
 * Matches against the single shared `COLOR_RE` so the parse and every guard
 * run one grammar.
 */
export function parseColorOrUndefined(value: string | undefined): Color | undefined {
  if (!value) return undefined;

  const match = value.match(COLOR_RE);

  if (!match || !match[1] || !match[2] || !match[3] || !match[4]) {
    return undefined;
  }

  const [r, g, b, a] = [match[1], match[2], match[3], match[4]].map((c) => matchedFloat(c)) as [
    number, number, number, number,
  ];
  // An overflowing exponent is inside the finite grammar and outside anything a
  // channel can hold, so it takes the same path as a literal the grammar
  // refuses outright.
  if (!allFinite([r, g, b, a])) return undefined;
  return { r, g, b, a };
}

/**
 * Parse a Color, falling back to `fallback` when the value is absent or the
 * grammar does not match. The color member of the `floatOr` / `intOr` /
 * `boolOr` / `enumOr` / `vec2Or` decoder family: a warn-free
 * `parseColorOrUndefined(value) ?? fallback` so every typed field carrying a
 * per-field default reads uniformly instead of open-coding the `?? default`.
 */
export function colorOr(value: string | undefined, fallback: Color): Color {
  return parseColorOrUndefined(value) ?? fallback;
}

/**
 * Parse Color from Godot format: Color(r, g, b, a)
 * Values are in range 0-1, but negative values and values > 1 are accepted
 * Returns white color { r: 1, g: 1, b: 1, a: 1 } if parsing fails
 */
export function parseColor(value: string | undefined): Color {
  return colorOr(value, { r: 1, g: 1, b: 1, a: 1 });
}

/**
 * Convert Godot Color string to three.js hex color number.
 * Example: "Color(1, 0.5, 0, 1)" -> 0xff8000
 * Returns white (0xffffff) if parsing fails
 */
export function parseColorToHex(value: string | undefined): number {
  const color = parseColor(value);

  // Clamp values to 0-1 range before converting to 0-255
  const clamp = (val: number) => Math.max(0, Math.min(1, val));

  const r = Math.round(clamp(color.r) * 255);
  const g = Math.round(clamp(color.g) * 255);
  const b = Math.round(clamp(color.b) * 255);

  return (r << 16) | (g << 8) | b;
}

/**
 * Format a Color for Inspector display as `rgba(r, g, b, a)` with 0–255
 * integer channels and a 2-decimal alpha. Shared by the node property
 * formatters (Node2D, Sprite3D, Label3D, Decal, …) so the modulate display
 * stays consistent across slices.
 */
export function formatColorRgba(color: Color): string {
  return `rgba(${(color.r * 255).toFixed(0)}, ${(color.g * 255).toFixed(0)}, ${(color.b * 255).toFixed(0)}, ${color.a.toFixed(2)})`;
}
