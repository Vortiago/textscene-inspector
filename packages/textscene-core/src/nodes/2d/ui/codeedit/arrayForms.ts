/**
 * The spellings CodeEdit's array properties arrive in, shared by `linterParser.ts` (the validator)
 * and `linter.ts` (the delimiter-collision rule). They must agree: a form the rule cannot parse
 * finds no start keys and never fires, and nothing reports it.
 */

import { packedArrayLiteral, stringLiteralBodies } from '../../../../godot/index.js';
import { unquoteString } from '../../../../parser/utils.js';

/**
 * `PackedStringArray("a")`, `Array[String](["a"])` or `["a"]`. The four string-array getters return
 * `TypedArray<String>` (code_edit.cpp:2036, :2065, :2222, :956), so the serializer writes `Array[String]`
 * (core/variant/variant_parser.cpp:2341-2344). The packed spelling reads back too, and a bare `[…]`
 * loads because `TypedArray<T>(const Array &)` converts element-wise (core/variant/typed_array.h:43-50).
 */
export const STRING_ARRAY_FORMS: readonly RegExp[] = [
  packedArrayLiteral('PackedStringArray'),
  /^\s*Array\s*\[\s*String\s*\]\s*\(\s*\[([\s\S]*)\]\s*\)\s*$/,
  /^\s*\[([\s\S]*)\]\s*$/,
];

/**
 * The one int-array spelling the parser narrows (`_parse_construct<int32_t>`, variant_parser.cpp:1428-1430).
 * Measured on 4.6.3, `Array[int]([4294967296, 1])` stores `[4294967296, 1]` and
 * `PackedInt32Array(4294967296, 1)` stores `[0, 1]`: the element width depends on the spelling.
 */
export const PACKED_INT32_ARRAY_RE = packedArrayLiteral('PackedInt32Array');

/**
 * `PackedInt32Array(24)`, `Array[int]([24])` or `[24]`. `line_length_guidelines` has a
 * `TypedArray<int>` getter (code_edit.cpp:2504) behind PACKED_INT32_ARRAY, so Godot writes
 * `Array[int]([24])`, as `scenes/demos/gui/control_gallery` does.
 */
export const INT_ARRAY_FORMS: readonly RegExp[] = [
  PACKED_INT32_ARRAY_RE,
  /^\s*Array\s*\[\s*int\s*\]\s*\(\s*\[([\s\S]*)\]\s*\)\s*$/,
  /^\s*\[([\s\S]*)\]\s*$/,
];

/**
 * The element list inside whichever form matches, trimmed, or `undefined` when none matches.
 * An empty string is an empty array, a different answer from `undefined`.
 */
export function arrayBody(value: string, forms: readonly RegExp[]): string | undefined {
  for (const form of forms) {
    const match = form.exec(value);
    if (match) return match[1]!.trim();
  }
  return undefined;
}

/**
 * Any of the three string-array spellings as raw (unescaped) elements, or `null` if malformed.
 * Each element must be one TK_STRING token (`variant_parser.cpp:1526-1529`), with one trailing
 * comma allowed and `[,]` or an interior `,,` malformed ({@link stringLiteralBodies}).
 */
export function parsePackedStringArray(value: string): string[] | null {
  const body = arrayBody(value, STRING_ARRAY_FORMS);
  if (body === undefined) return null;
  // `unquoteString`, not a `\\(.)` collapse: the tokenizer resolves `\\uXXXX` and
  // `\\n`, `\\r`, `\\t` before any setter runs, so `\\u00ab` is one code point, not `u00ab`.
  return stringLiteralBodies(body)?.map(unquoteString) ?? null;
}
