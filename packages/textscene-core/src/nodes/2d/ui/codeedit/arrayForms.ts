/**
 * The spellings CodeEdit's array properties actually arrive in.
 *
 * Shared by `linterParser.ts` (which validates the literal) and `linter.ts`
 * (whose delimiter-collision rule re-parses it). They must agree: a form the
 * rule cannot parse makes it silently find no start keys and never fire, which
 * is worse than the validator's loud rejection because nothing reports it.
 *
 * Every one of CodeEdit's `PACKED_STRING_ARRAY` properties is declared one type
 * and stored as another. `delimiter_strings`, `delimiter_comments`,
 * `code_completion_prefixes` and `indent_automatic_prefixes` have
 * `TypedArray<String>` getters (code_edit.cpp:2036, :2065, :2222, :956) behind a
 * `PropertyInfo(Variant::PACKED_STRING_ARRAY, …)`, and `line_length_guidelines`
 * is the same trap one type over: `TypedArray<int>` (code_edit.cpp:2504) behind
 * `Variant::PACKED_INT32_ARRAY`. The GETTER's value is what reaches the
 * serializer, so it takes the `is_typed()` branch and writes
 * `Array[String](["x"])` / `Array[int]([24])`
 * (core/variant/variant_parser.cpp:2341-2344) rather than the declared packed
 * spelling. `scenes/demos/gui/control_gallery` carries the int case.
 *
 * The declared packed spelling stays accepted: Godot's parser reads it back
 * happily, and a hand-written or older scene may well use it.
 *
 * The bare `[…]` spelling is accepted for a reason of its own, not by analogy:
 * `TypedArray<T>(const Array &)` (core/variant/typed_array.h:43-50) calls
 * `assign(p_array)` whenever the incoming array is not already same-typed, so an
 * untyped literal converts element-wise on the way into the setter and loads.
 */

/** `PackedStringArray("a")`, `Array[String](["a"])`, or `["a"]`. */
export const STRING_ARRAY_FORMS: readonly RegExp[] = [
  /^\s*PackedStringArray\s*\(([\s\S]*)\)\s*$/,
  /^\s*Array\s*\[\s*String\s*\]\s*\(\s*\[([\s\S]*)\]\s*\)\s*$/,
  /^\s*\[([\s\S]*)\]\s*$/,
];

/**
 * The one int-array spelling the PARSER narrows.
 *
 * `_parse_construct<int32_t>` (variant_parser.cpp:1428-1430) builds the packed
 * form element by element, so the setter receives int32s; the typed and bare
 * forms reach `TypedArray<int>` as int64 elements and are stored verbatim.
 * Measured on 4.6.3, `line_length_guidelines = Array[int]([4294967296, 1])`
 * stores `[4294967296, 1]` where `PackedInt32Array(4294967296, 1)` stores
 * `[0, 1]` — so the element width is a per-SPELLING fact for this property, not
 * a per-slot one.
 */
export const PACKED_INT32_ARRAY_RE = /^\s*PackedInt32Array\s*\(([\s\S]*)\)\s*$/;

/** `PackedInt32Array(24)`, `Array[int]([24])`, or `[24]`. */
export const INT_ARRAY_FORMS: readonly RegExp[] = [
  PACKED_INT32_ARRAY_RE,
  /^\s*Array\s*\[\s*int\s*\]\s*\(\s*\[([\s\S]*)\]\s*\)\s*$/,
  /^\s*\[([\s\S]*)\]\s*$/,
];

/**
 * The element list inside whichever form matches, trimmed, or `undefined` when
 * the value is none of them. An empty string means an empty array, which is a
 * different answer from `undefined` and the reason this does not just return a
 * string.
 */
export function arrayBody(value: string, forms: readonly RegExp[]): string | undefined {
  for (const form of forms) {
    const match = form.exec(value);
    if (match) return match[1]!.trim();
  }
  return undefined;
}

const PACKED_STRING_ARRAY_BODY_RE = /^"(?:[^"\\]|\\[\s\S])*"(?:\s*,\s*"(?:[^"\\]|\\[\s\S])*")*$/;
const QUOTED_ELEMENT_CAPTURE_RE = /"((?:[^"\\]|\\[\s\S])*)"/g;

/**
 * Any of the three string-array spellings into raw (unescaped) elements, or
 * `null` if the literal is malformed — the element grammar mirrors
 * `variant_parser.cpp:1500-1533`'s PackedStringArray branch, which requires
 * every element to be a TK_STRING token. No `v.ts` combinator covers this shape
 * (only `packedVector2Array` exists), matching `FileDialog.filters`
 * (nodes/windows/filedialog/linterParser.ts).
 */
export function parsePackedStringArray(value: string): string[] | null {
  const body = arrayBody(value, STRING_ARRAY_FORMS);
  if (body === undefined) return null;
  if (body === '') return [];
  if (!PACKED_STRING_ARRAY_BODY_RE.test(body)) return null;
  const elements: string[] = [];
  for (const m of body.matchAll(QUOTED_ELEMENT_CAPTURE_RE)) {
    elements.push((m[1] ?? '').replace(/\\(.)/g, '$1'));
  }
  return elements;
}
