/**
 * The lenient parser's vector decoders.
 *
 * The GRAMMAR they read is an engine fact and lives in `godot/variant/number.ts`; this
 * file is the render-side decoding built on it, so its types may be domain
 * types. Anything here that a second domain would want belongs there instead.
 */

import { slotTupleRegex, allFinite } from '../godot/variant/number.js';
import { readSlotTuple } from '../godot/variant/int.js';

import type { Vector2, Vector3 } from '../godot/math/vector.js';

const VECTOR2_RE = slotTupleRegex('Vector2', 2);
const VECTOR3_RE = slotTupleRegex('Vector3', 3);

/**
 * `Color(r, g, b, a)`, with the vectors' float grammar. Compiled once and shared by the
 * Color decoder and linter validators, so render and lint agree on the channel grammar.
 * No `g` flag, so `.test()` and `.match()` on the shared instance are stateless.
 */
export const COLOR_RE = slotTupleRegex('Color', 4);

export function parseVector2(value: string): Vector2 {
  const [x, y] = finiteSlotTuple(value, 'Vector2', VECTOR2_RE);
  return { x: x!, y: y! };
}

export function parseVector3(value: string): Vector3 {
  const [x, y, z] = finiteSlotTuple(value, 'Vector3', VECTOR3_RE);
  return { x: x!, y: y!, z: z! };
}

/**
 * The components of a vector literal, or a throw the caller turns into its fallback. An
 * overflowing exponent is inside the finite grammar but not inside what a viewport can draw.
 * An `i` spelling narrows to int32 first, and a component no int32 holds reads NaN.
 */
function finiteSlotTuple(value: string, typeName: string, grammar: RegExp): number[] {
  const tuple = readSlotTuple(value, typeName, grammar);
  if (!tuple) throw new Error(`Invalid ${typeName} format: ${value}`);
  if (!allFinite(tuple.components)) throw new Error(`Non-finite ${typeName}: ${value}`);
  return tuple.components;
}
