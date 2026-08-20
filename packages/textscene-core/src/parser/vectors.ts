/**
 * The lenient parser's vector decoders.
 *
 * The GRAMMAR they read is an engine fact and lives in `godot/number.ts`; this
 * file is the render-side decoding built on it, so its types may be domain
 * types. Anything here that a second domain would want belongs there instead.
 */

import { slotTupleRegex, allFinite } from '../godot/number.js';
import { slotComponents } from '../godot/int.js';

export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

const VECTOR2_RE = slotTupleRegex('Vector2', 2);
const VECTOR3_RE = slotTupleRegex('Vector3', 3);

/**
 * `Color(r, g, b, a)` — the SAME float grammar as the vectors above. Compiled ONCE and shared by
 * the material/Environment Color decoder and linter validators so render and lint agree on
 * the channel grammar and never rebuild this regex per parse/lint call. No `g` flag, so `.test()`
 * and `.match()` on the shared instance are stateless.
 */
export const COLOR_RE = slotTupleRegex('Color', 4);

export function parseVector2(value: string): Vector2 {
  const match = value.match(VECTOR2_RE);

  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid Vector2 format: ${value}`);
  }

  // An overflowing exponent is inside the finite grammar but not inside what a
  // viewport can draw, so it takes the same warn-then-fall-back path as a
  // literal the grammar refuses. A `Vector2i` spelling narrows to int32 first.
  const components = slotComponents(value, 'Vector2', [match[1], match[2]]);
  if (!allFinite(components)) throw new Error(`Non-finite Vector2: ${value}`);
  return { x: components[0]!, y: components[1]! };
}

export function parseVector3(value: string): Vector3 {
  const match = value.match(VECTOR3_RE);

  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error(`Invalid Vector3 format: ${value}`);
  }

  const components = slotComponents(value, 'Vector3', [match[1], match[2], match[3]]);
  if (!allFinite(components)) throw new Error(`Non-finite Vector3: ${value}`);
  return { x: components[0]!, y: components[1]!, z: components[2]! };
}
