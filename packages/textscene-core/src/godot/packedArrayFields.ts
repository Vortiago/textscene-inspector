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
 * The text of the first `"key": <value>` whose value is a `Packed…Array(…)` call, an `Array[T]([…])`
 * wrapper or a bare `[…]`, or null when the text holds none. Each body stops at its first closing
 * delimiter, as the elements carry parentheses, never brackets.
 */
export function dictPackedField(key: string, packedTypeName: string): (text: string) => string | null {
  const element = packedElementType(packedTypeName);
  const field = new RegExp(`"${key}"${WS}:${WS}`, 'g');
  // Sticky, so each tests one key's value alone. A read sets `lastIndex` first and never yields.
  const packedOpener = new RegExp(`${packedTypeName}${WS}\\(`, 'y');
  const bracketed = new RegExp(
    `Array${WS}\\[${WS}${element}${WS}\\]${WS}\\(${WS}\\[[^[\\]]*\\]${WS}\\)|\\[[^[\\]]*\\]`,
    'y'
  );
  return (text) => {
    // A packed body runs to the first `)`, so a call that opens past the last `)` never closes. A
    // `[^)]*` search would rescan to the end from each such call, in quadratic time.
    const lastClose = text.lastIndexOf(')');
    for (const match of text.matchAll(field)) {
      const valueStart = match.index + match[0].length;
      packedOpener.lastIndex = valueStart;
      if (packedOpener.test(text)) {
        const bodyStart = packedOpener.lastIndex;
        if (bodyStart <= lastClose) return text.slice(valueStart, text.indexOf(')', bodyStart) + 1);
        continue;
      }
      bracketed.lastIndex = valueStart;
      const value = bracketed.exec(text);
      if (value !== null) return value[0];
    }
    return null;
  };
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
