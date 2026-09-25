/** The StandardMaterial3D slice's throwing Color reader. */

import type { Color } from './types';
import { COLOR_RE } from '../../../parser/vectors';
import { matchedFloat } from '../../../godot/number.js';

/**
 * Parse `Color(r, g, b, a)`, throwing on a malformed literal. Channels are not clamped,
 * as an HDR colour exceeds 1.
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
