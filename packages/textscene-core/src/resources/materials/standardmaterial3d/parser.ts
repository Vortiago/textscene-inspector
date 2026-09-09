/**
 * StandardMaterial3D parser - Color parsing for StandardMaterial3D resources.
 */

import type { Color } from './types';
import { COLOR_RE } from '../../../parser/vectors';
import { matchedFloat } from '../../../godot/number.js';

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
    r: matchedFloat(match[1]),
    g: matchedFloat(match[2]),
    b: matchedFloat(match[3]),
    a: matchedFloat(match[4]),
  };
}
