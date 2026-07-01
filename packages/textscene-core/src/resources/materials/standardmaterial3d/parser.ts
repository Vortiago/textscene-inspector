/**
 * StandardMaterial3D parser - Color parsing for StandardMaterial3D resources.
 */

import type { Color } from './types';
import { COLOR_RE } from '../../../parser/vectors';

/**
 * Parse Color from Godot format: Color(r, g, b, a)
 * Values are in range 0-1
 */
export function parseColor(value: string): Color {
  const match = value.match(COLOR_RE);

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
