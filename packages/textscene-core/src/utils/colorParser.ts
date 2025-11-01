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
 * Values are in range 0-1, but negative values and values > 1 are accepted
 * Returns white color { r: 1, g: 1, b: 1, a: 1 } if parsing fails
 */
export function parseColor(value: string | undefined): Color {
  // Handle undefined/null/empty input - return white as fallback
  if (!value) {
    return { r: 1, g: 1, b: 1, a: 1 };
  }

  // Updated regex to support negative numbers and decimals
  const match = value.match(/^Color\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/);

  if (!match || !match[1] || !match[2] || !match[3] || !match[4]) {
    // Return white as fallback instead of throwing
    return { r: 1, g: 1, b: 1, a: 1 };
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
