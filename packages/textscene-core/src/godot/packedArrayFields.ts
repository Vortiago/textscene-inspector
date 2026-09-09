/**
 * A packed-array FIELD inside a serialised Dictionary, in any spelling the
 * slot converts.
 *
 * A `PackedVector3Array rp = p_data["points"]` read (`curve.cpp:2282`) is a
 * Variant conversion, and `can_convert_strict` lists ARRAY as a source for
 * every PACKED_* type (`variant.cpp:449-478`) — so a `_data` dictionary written
 * with `"points": [Vector3(…), …]` or `Array[Vector3]([…])` loads the same
 * points as the packed constructor.
 */

import { packedElementType } from './variantParser.js';

const WS = '\\s*';

/**
 * `"key": <value>` where the value is a `Packed…Array(…)` call, an
 * `Array[T]([…])` wrapper or a bare `[…]`; `[1]` is the WHOLE value text, for
 * `packedArrayBody` to take apart. Each body stops at its first closing
 * delimiter, the discipline `packedArrayCallAnywhere` sets for scanning a
 * larger string: the elements of these arrays carry parentheses, never
 * brackets, so a bracket body of `[^[\\]]*` is the whole literal.
 *
 * Pass `global` for a repeated scan — a `g`-flagged RegExp carries `lastIndex`,
 * so each caller needs its own instance.
 */
export function dictPackedField(key: string, packedTypeName: string, global = false): RegExp {
  const element = packedElementType(packedTypeName);
  const packed = `${packedTypeName}${WS}\\([^)]*\\)`;
  const typed = `Array${WS}\\[${WS}${element}${WS}\\]${WS}\\(${WS}\\[[^[\\]]*\\]${WS}\\)`;
  const bare = `\\[[^[\\]]*\\]`;
  return new RegExp(`"${key}"${WS}:${WS}((?:${packed}|${typed}|${bare}))`, global ? 'g' : '');
}
