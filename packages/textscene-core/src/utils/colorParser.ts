/**
 * Parses Godot Color format to three.js hex color.
 */

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Parse Color from Godot format: Color(r, g, b, a)
 * Values are in range 0-1
 */
export function parseColor(value: string): Color {
  const match = value.match(/^Color\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/);

  if (!match || !match[1] || !match[2] || !match[3] || !match[4]) {
    throw new Error(`Invalid Color format: ${value}`);
  }

  return {
    r: parseFloat(match[1]),
    g: parseFloat(match[2]),
    b: parseFloat(match[3]),
    a: parseFloat(match[4]),
  };
}

/**
 * Convert Godot Color string to three.js hex color number.
 * Example: "Color(1, 0.5, 0, 1)" -> 0xff8000
 */
export function parseColorToHex(value: string): number {
  const color = parseColor(value);

  // Convert 0-1 range to 0-255 and combine into hex
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);

  return (r << 16) | (g << 8) | b;
}
