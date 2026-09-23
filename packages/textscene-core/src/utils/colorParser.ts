/**
 * Reads a Godot `Color(r, g, b, a)` literal as channels or as a three.js hex colour.
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
 * A `Color(r, g, b, a)` literal, channels below 0 and above 1 included. Undefined when absent or
 * malformed, for a caller that skips a bad colour rather than substitute white. The shared
 * `COLOR_RE` keeps the parse and every guard on one grammar.
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
 * A Color, or `fallback` when absent or malformed: the colour member of the `floatOr`, `intOr`,
 * `boolOr`, `enumOr` and `vec2Or` decoder family, so a field with a default reads uniformly.
 */
export function colorOr(value: string | undefined, fallback: Color): Color {
  return parseColorOrUndefined(value) ?? fallback;
}

/** A Color, or opaque white when absent or malformed. */
export function parseColor(value: string | undefined): Color {
  return colorOr(value, { r: 1, g: 1, b: 1, a: 1 });
}

/** A Color as a three.js hex number: "Color(1, 0.5, 0, 1)" is 0xff8000. White when malformed. */
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
