/**
 * A packed-array field inside a serialised Dictionary, in any spelling the slot converts. A
 * `PackedVector3Array rp = p_data["points"]` read (`curve.cpp:2282`) is a Variant conversion, and
 * `can_convert_strict` accepts ARRAY for every PACKED_* type (`variant.cpp:449-478`), so
 * `"points": [Vector3(…), …]` and `Array[Vector3]([…])` load the same points.
 */

import { splitTopLevel } from './string.js';
import { packedArrayBody, packedElementType } from './variantParser.js';

const WS = '\\s*';

/**
 * `"key": <value>` for a `Packed…Array(…)` call, an `Array[T]([…])` wrapper or a bare `[…]`, with the
 * whole value text in `[1]`. Each body stops at its first closing delimiter, as the elements carry
 * parentheses, never brackets. Pass `global` for a repeated scan: a `g`-flagged RegExp carries
 * `lastIndex`, so each caller needs its own instance.
 */
export function dictPackedField(key: string, packedTypeName: string, global = false): RegExp {
  const element = packedElementType(packedTypeName);
  const packed = `${packedTypeName}${WS}\\([^)]*\\)`;
  const typed = `Array${WS}\\[${WS}${element}${WS}\\]${WS}\\(${WS}\\[[^[\\]]*\\]${WS}\\)`;
  const bare = `\\[[^[\\]]*\\]`;
  return new RegExp(`"${key}"${WS}:${WS}((?:${packed}|${typed}|${bare}))`, global ? 'g' : '');
}

/**
 * How many floats a packed field's value holds, counted without reading them: the packed
 * constructor lists them flat, and the two array spellings hold one `groupSize`-float
 * element each.
 */
export function packedFloatCount(forms: readonly RegExp[], value: string, groupSize: number): number {
  const matched = packedArrayBody(forms, value);
  if (!matched || matched.body === '') return 0;
  const parts = matched.flat ? matched.body.split(',') : splitTopLevel(matched.body);
  const count = parts.filter((s) => s.trim() !== '').length;
  return matched.flat ? count : count * groupSize;
}
