/**
 * The lenient parser's vector decoders.
 *
 * The GRAMMAR they read is an engine fact and lives in `godot/number.ts`; this
 * file is the render-side decoding built on it, so its types may be domain
 * types. Anything here that a second domain would want belongs there instead.
 */

import { finiteTupleRegex, matchedFloat } from '../godot/number.js';

export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

const VECTOR2_RE = finiteTupleRegex('Vector2', 2);
const VECTOR3_RE = finiteTupleRegex('Vector3', 3);

/**
 * `Color(r, g, b, a)` — the SAME float grammar as the vectors above. Compiled ONCE and shared by
 * the material/Environment Color decoder and linter validators so render and lint agree on
 * the channel grammar and never rebuild this regex per parse/lint call. No `g` flag, so `.test()`
 * and `.match()` on the shared instance are stateless.
 */
export const COLOR_RE = finiteTupleRegex('Color', 4);

export function parseVector2(value: string): Vector2 {
  const match = value.match(VECTOR2_RE);

  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid Vector2 format: ${value}`);
  }

  return {
    x: matchedFloat(match[1]),
    y: matchedFloat(match[2]),
  };
}

export function parseVector3(value: string): Vector3 {
  const match = value.match(VECTOR3_RE);

  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error(`Invalid Vector3 format: ${value}`);
  }

  return {
    x: matchedFloat(match[1]),
    y: matchedFloat(match[2]),
    z: matchedFloat(match[3]),
  };
}
