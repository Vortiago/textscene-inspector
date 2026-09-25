/** `variant_parser.cpp`'s constructor-call literals, as the engine reads them. */

/**
 * Godot's reader tokenises rather than pattern-matches: `VariantParser::get_token` discards any character `<= 32` before a
 * token (variant_parser.cpp:415-417), and the `NodePath` / `SubResource` / `ExtResource` branches ask only for the next token
 * to be `(` (`:1089-1093`), so `SubResource ( "id" )` loads like the tight form. Only a hand-edited file carries the spaces.
 * Every pattern below derives from one body string per literal, so no copy can diverge on padding.
 */
import { TSCN_FLOAT_PATTERN_SOURCE } from './number.js';

const WS = '\\s*';

/**
 * A `NodePath("…")` literal, capturing the path. An empty path is legal and common.
 * `[^"]*`, not `.*`: the greedy form reads `NodePath("a") junk NodePath("b")` as one path.
 */
const NODE_PATH_BODY = `NodePath${WS}\\(${WS}"([^"]*)"${WS}\\)`;

/**
 * A bare `[…]` array literal, capturing the body. Exported for a caller that parses the body. A caller that only needs
 * the shape uses `v.arrayLiteral` instead of re-deriving this.
 */
export const ARRAY_LITERAL_RE = /^\[([\s\S]*)\]$/;

/**
 * A bare `[…]` or a typed `Array[Type]([…])` literal. The writer wraps elements in `Array[Type](…)` when `Array::is_typed()`
 * (variant_parser.cpp:2341-2344), that is when the `ADD_PROPERTY` carries `PROPERTY_HINT_ARRAY_TYPE`. So which spelling a
 * validator accepts is a per-property fact its call site states.
 */
export const TYPED_OR_BARE_ARRAY_RE = /^(?:\[[\s\S]*\]|Array\[[^[\]]+\]\(\[[\s\S]*\]\))$/;

/** A typed `Array[T]([…])` wrapper alone; `[1]` is the element type `T`. */
export const TYPED_WRAPPER_RE = /^Array\[([^[\]]+)\]\(\[[\s\S]*\]\)$/;

/**
 * The text between the brackets of a bare `[…]` or a typed `Array[T]([…])` value, or null when it is neither.
 * Positional, never a second grammar: the caller vets the shape. `value.trim().slice(1, -1)` would read `rray[int]([0, 4`
 * out of `Array[int]([0, 4])`, so every reader of this body shares this one.
 */
export function arrayLiteralBody(value: string): string | null {
  const text = value.trim();
  const wrapped = TYPED_WRAPPER_RE.exec(text);
  // `Array[` + the captured element type + `](`, then the bare literal, then `)`.
  const bare = wrapped
    ? text.slice('Array['.length + wrapped[1]!.length + ']('.length, -1).trim()
    : text;
  return ARRAY_LITERAL_RE.exec(bare)?.[1] ?? null;
}

/**
 * A whole `Packed…Array(…)` constructor call, capturing the argument body. Built, not written out: a hand-written copy
 * drops the padding the tokenizer discards, and a padded `PackedByteArray ( … )` then decodes to nothing.
 * The body is greedy to the last paren, for a value that is one constructor call. To scan a larger string, use
 * `packedArrayCallAnywhere`, whose body stops at the first paren.
 */
export function packedArrayLiteral(typeName: string): RegExp {
  return new RegExp(`^${WS}${typeName}${WS}\\(([\\s\\S]*)\\)${WS}$`);
}

/**
 * `TypeName(` at the start of a value: a discriminator, not a parse, for a caller asking only which composite this is.
 * It has the same leading and inner padding tolerance as every builder here.
 */
export function compositeCallPrefix(...typeNames: readonly string[]): RegExp {
  return new RegExp(`^${WS}(?:${typeNames.join('|')})${WS}\\(`);
}

/** A `TypeName(…)` call inside a larger value, the body captured up to the first `)`. */
function callBody(typeName: string): string {
  return `${typeName}${WS}\\(([^)]*)\\)`;
}

/**
 * The same call anywhere in a larger value. `[1]` is the body, which stops at the first `)`. Pass `global` for a
 * repeated scan: a `g`-flagged RegExp carries `lastIndex`, so each caller needs its own instance.
 */
export function packedArrayCallAnywhere(typeName: string, global = false): RegExp {
  return new RegExp(callBody(typeName), global ? 'g' : '');
}

/**
 * A Dictionary field whose value is one `TypeName(…)` call, `[1]` the body up to the first `)`:
 * `"cells": PackedInt32Array(…)`, `"aabb": AABB(…)`. A slot that also converts `[…]` or
 * `Array[T]([…])` wants `dictPackedField` (`packedArrayFields.ts`) instead.
 */
export function dictCallField(key: string, typeName: string): RegExp {
  return new RegExp(`"${key}"${WS}:${WS}${callBody(typeName)}`);
}

/**
 * A field of a serialised Dictionary whose value is a number, `[1]` the literal (`global` as for {@link packedArrayCallAnywhere}).
 * The value runs to its `,`/`}`, so `1.2.3` matches nothing instead of reading `1.2`. The grammar is the writer's, `inf` included:
 * a caller that cannot use `inf` rejects it, but one that stopped matching there would pair later values with the wrong keys.
 * It lives here because `godotLiteralGrammar.guard.test.ts` forbids a second reader of the scalar grammar.
 */
export function dictNumberField(key: string, global = false): RegExp {
  return new RegExp(
    `"${key}"${WS}:${WS}(${TSCN_FLOAT_PATTERN_SOURCE})${WS}(?=[,}])`,
    global ? 'g' : ''
  );
}

/**
 * A whole value that is nil, in either spelling: `variant_parser.cpp:699` takes `null` and `nil` through one arm to
 * `Variant()`. The writer emits only `null` (`:2013`), a write-side fact that does not bound the loader. Whole values only:
 * `_parse_construct` (`:552-598`) admits an identifier only where `stor_fix` (`:149-159`) knows it (`inf`, `-inf`, `inf_neg`,
 * `nan`), so `Vector2(nil, 0)` is an `ERR_PARSE_ERROR` and the composite grammars must not take this.
 */
export function isNilLiteral(value: string): boolean {
  return NIL_LITERAL_RE.test(value);
}

const NIL_LITERAL_RE = /^\s*(?:null|nil)\s*$/;

/**
 * A value that is exactly a `NodePath("…")` literal, the shape check for an element of `Array[NodePath]([…])`. A NodePath
 * slot also takes a bare string, which is {@link nodePathLiteral}'s question. No `g` flag, so `.test()` is stateless.
 */
export const NODE_PATH_LITERAL_RE = new RegExp(`^${NODE_PATH_BODY}$`);

/** The first `NodePath("…")` literal anywhere in a value. */
export const NODE_PATH_LITERAL_ANYWHERE_RE = new RegExp(NODE_PATH_BODY);

/** A whole value that is one plain quoted string, capturing the body. */
const QUOTED_STRING_RE = /^"([^"]*)"$/;

/**
 * The path a NodePath slot stores from this value, or null when it stores none: the `NodePath("…")` literal, or the bare
 * `"…"` string `can_convert_strict` converts (`variant.cpp:746-749`: `case NODE_PATH: valid[] = { STRING, NIL }`), which
 * `Variant::operator NodePath()` (`:2001`) builds from. A StringName is not in that list, so `&"…"` is null. `NodePath("")`
 * is `''`, not null, so a cleared key keeps its meaning (unset). Neither form decodes escapes: resolvers compare the body as written.
 */
export function nodePathLiteral(raw: string): string | null {
  const value = raw.trim();
  return NODE_PATH_LITERAL_RE.exec(value)?.[1] ?? QUOTED_STRING_RE.exec(value)?.[1] ?? null;
}

/**
 * The element type Godot names inside `Array[T]([…])` for each packed type. The getter decides the spelling: a
 * `TypedArray<T>` behind a `PropertyInfo(Variant::PACKED_*, …)` takes the `is_typed()` branch
 * (`variant_parser.cpp:2341-2344`) and writes `Array[T]([…])`, not the declared packed name.
 */
const PACKED_ELEMENT_TYPE: Readonly<Record<string, string>> = {
  PackedByteArray: 'int',
  PackedInt32Array: 'int',
  PackedInt64Array: 'int',
  PackedFloat32Array: 'float',
  PackedFloat64Array: 'float',
  PackedStringArray: 'String',
  PackedVector2Array: 'Vector2',
  PackedVector3Array: 'Vector3',
  PackedVector4Array: 'Vector4',
  PackedColorArray: 'Color',
};

/**
 * The three spellings a packed slot accepts, packed form first. `can_convert_strict` lists ARRAY as a source for every
 * PACKED_* type (`variant.cpp:467-473`) and the write converts: on 4.6.3 `points = [Vector2(0, 0), Vector2(5, 5)]` stores a
 * PackedVector2Array and `split_offsets = Array[int]([3, 7])` a PackedInt32Array. The packed constructor takes a flat list,
 * divided by the group size (`variant_parser.cpp:1555`), while the other two hold one element each. `[0]` is the packed form.
 */
export function packedArrayForms(packedTypeName: string): readonly RegExp[] {
  const element = packedElementType(packedTypeName);
  return [
    packedArrayLiteral(packedTypeName),
    new RegExp(`^${WS}Array${WS}\\[${WS}${element}${WS}\\]${WS}\\(${WS}\\[([\\s\\S]*)\\]${WS}\\)${WS}$`),
    ARRAY_LITERAL_RE,
  ];
}

/**
 * The type each element of the bare and typed bodies is spelled with, and the
 * `T` the typed wrapper names.
 */
export function packedElementType(packedTypeName: string): string {
  return PACKED_ELEMENT_TYPE[packedTypeName] ?? packedTypeName;
}

/** Which body shape a packed value carries, and the body itself, trimmed. */
export interface PackedArrayBody {
  /** The packed constructor's flat argument list, rather than one element per comma. */
  flat: boolean;
  body: string;
}

/**
 * The body of `value` under whichever of {@link packedArrayForms} matches it, or null when none does. It takes the forms,
 * not a type name, so a reader keeps the three RegExps at module scope, and turns the match index into the `flat` flag
 * every reader of a packed slot branches on.
 */
export function packedArrayBody(
  forms: readonly RegExp[],
  value: string
): PackedArrayBody | null {
  for (let i = 0; i < forms.length; i++) {
    const match = forms[i]!.exec(value);
    if (match) return { flat: i === 0, body: match[1]!.trim() };
  }
  return null;
}
