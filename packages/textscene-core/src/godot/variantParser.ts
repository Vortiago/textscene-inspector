/** `variant_parser.cpp`'s constructor-call literals, as the engine reads them. */

/**
 * Godot's reader TOKENISES rather than pattern-matches. `VariantParser::get_token`
 * discards any character `<= 32` before a token (variant_parser.cpp:415-417), and the
 * `NodePath` / `SubResource` / `ExtResource` branches then ask only for the next token
 * to be a `(` (`:1089-1093`). So `SubResource ( "id" )` and `NodePath( "../Body" )`
 * load exactly like the tight forms.
 *
 * Godot's own writer never pads, so only a hand-edited file carries the spaces, which
 * is the file a linter exists for.
 *
 * Every pattern below is DERIVED from one body string per literal rather than written
 * out, because the alternative was measured: eleven hand-written copies of these two
 * patterns had drifted into four spellings. Three of them wore a comment deferring to
 * a fourth for its whitespace handling while not actually matching it, and the split
 * let the linter accept a padded `SubResource ("id")` that the animation and curve
 * parsers then dropped on the floor. Derivation makes that divergence unrepresentable
 * instead of merely discouraged.
 */
import { TSCN_FLOAT_PATTERN_SOURCE } from './number.js';

const WS = '\\s*';

/**
 * A `NodePath("…")` literal, capturing the path. An EMPTY path is legal and common.
 *
 * `[^"]*` rather than `.*`: the greedy form only anchors the first and last character,
 * so `NodePath("a") junk NodePath("b")` matches as one path. Measured across the corpus
 * (784 NodePath values) the two forms disagree on nothing, so this costs no leniency.
 */
const NODE_PATH_BODY = `NodePath${WS}\\(${WS}"([^"]*)"${WS}\\)`;

/**
 * A bare `[…]` array literal, capturing the body.
 *
 * Exported for the two callers that go on to PARSE the body (GridMap's mesh list,
 * AnimationPlayer's library list) rather than merely shape-check it. A caller that
 * only needs the shape wants `v.arrayLiteral` instead of re-deriving this.
 */
export const ARRAY_LITERAL_RE = /^\[([\s\S]*)\]$/;

/**
 * A bare `[…]` OR a typed `Array[Type]([…])` literal.
 *
 * `Array::is_typed()` makes the writer wrap the elements in `Array[Type](…)`
 * (variant_parser.cpp:2341-2344), which happens exactly when the property carries
 * element-type info — `PROPERTY_HINT_ARRAY_TYPE` on the `ADD_PROPERTY`. So the two
 * spellings are not interchangeable per property, and which one a validator accepts
 * is a per-property fact its call site has to state.
 */
export const TYPED_OR_BARE_ARRAY_RE = /^(?:\[[\s\S]*\]|Array\[[^[\]]+\]\(\[[\s\S]*\]\))$/;

/** A typed `Array[T]([…])` wrapper alone; `[1]` is the element type `T`. */
export const TYPED_WRAPPER_RE = /^Array\[([^[\]]+)\]\(\[[\s\S]*\]\)$/;

/**
 * The text between the brackets of a bare `[…]` or a typed `Array[T]([…])`
 * value, or null when it is neither.
 *
 * Positional, never a second grammar: the caller has vetted (or goes on to
 * vet) the shape, so this only knows WHERE the elements sit in each spelling.
 * A caller reaching for `value.trim().slice(1, -1)` reads `rray[int]([0, 4`
 * out of `Array[int]([0, 4])` and then counts pairs on text that is not the
 * array — which is why the four readers of this body share one reader.
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
 * A whole `Packed…Array(…)` constructor call, capturing the argument body.
 *
 * Built rather than written out for the reason this file exists: a hand-written
 * copy drops the padding Godot's tokenizer discards, and then a hand-edited
 * `PackedByteArray ( … )` decodes to nothing and a TileMapLayer silently renders
 * no tiles.
 *
 * The body is greedy to the LAST paren, which is what a value that is entirely
 * one constructor call needs. For SCANNING a larger string use
 * `packedArrayCallAnywhere`, whose body stops at the first paren.
 */
export function packedArrayLiteral(typeName: string): RegExp {
  return new RegExp(`^${WS}${typeName}${WS}\\(([\\s\\S]*)\\)${WS}$`);
}

/**
 * `TypeName(` at the START of a value — a discriminator, not a parse.
 *
 * For the callers asking only "which composite is this", where extracting
 * components would be doing more work than the question needs. Carries the same
 * leading and inner padding tolerance as every other builder here, which a
 * hand-rolled `/^Color\s*\(/` did and a hand-rolled `/^Color\(/` would not.
 */
export function compositeCallPrefix(...typeNames: readonly string[]): RegExp {
  return new RegExp(`^${WS}(?:${typeNames.join('|')})${WS}\\(`);
}

/**
 * The same call found ANYWHERE in a larger value; `[1]` is the body, which stops
 * at the first `)`. Pass `global` for a repeated scan — a `g`-flagged RegExp
 * carries `lastIndex`, so each caller needs its own instance.
 */
export function packedArrayCallAnywhere(typeName: string, global = false): RegExp {
  return new RegExp(`${typeName}${WS}\\(([^)]*)\\)`, global ? 'g' : '');
}

/**
 * A field of a serialised Dictionary whose value is a NUMBER; `[1]` is the
 * literal. Pass `global` for a repeated scan — a `g`-flagged RegExp carries
 * `lastIndex`, so each caller needs its own instance.
 *
 * The value runs to its `,`/`}` delimiter rather than stopping wherever the
 * number grammar stops, so a malformed `1.2.3` matches nothing and the caller
 * falls back — instead of reading the prefix `1.2`, which is the
 * stop-at-the-first-bad-character defect this whole grammar exists to end.
 *
 * The grammar is the WRITER's, non-finite spellings included, because this only
 * decides which text is the field's value. A caller that cannot use `inf`
 * rejects the number it read; one that stops MATCHING at `inf` loses the field
 * itself, and a dict scanned field-by-field then pairs its values against the
 * wrong keys.
 *
 * Here rather than at the call site because the scalar grammar may not be
 * rebuilt outside this module: a second reader of it is exactly what
 * `godotLiteralGrammar.guard.test.ts` forbids.
 */
export function dictNumberField(key: string, global = false): RegExp {
  return new RegExp(
    `"${key}"${WS}:${WS}(${TSCN_FLOAT_PATTERN_SOURCE})${WS}(?=[,}])`,
    global ? 'g' : ''
  );
}

/**
 * A whole value that is NIL, in either of the two spellings Godot reads.
 *
 * `variant_parser.cpp:699` takes `null` and `nil` through ONE arm to `Variant()`,
 * so a slot that accepts either accepts both. The writer only ever emits `null`
 * (`:2013`), which is a write-side fact and does not bound what the loader takes.
 *
 * Whole values only. `_parse_construct` (`:552-598`) admits an identifier argument
 * only where `stor_fix` (`:149-159`) recognises it, and it knows `inf`, `-inf`,
 * `inf_neg` and `nan` and nothing else — so `Vector2(nil, 0)` is a real
 * `ERR_PARSE_ERROR` and the composite grammars must not take this.
 */
export function isNilLiteral(value: string): boolean {
  return NIL_LITERAL_RE.test(value);
}

const NIL_LITERAL_RE = /^\s*(?:null|nil)\s*$/;

/**
 * A value that is EXACTLY a `NodePath("…")` literal. No `g` flag, so `.test()` is stateless.
 *
 * The LITERAL only. A NodePath slot also takes a bare string, which is
 * {@link nodePathLiteral}'s question; this stays the shape check for an
 * element inside `Array[NodePath]([…])`.
 */
export const NODE_PATH_LITERAL_RE = new RegExp(`^${NODE_PATH_BODY}$`);

/** The first `NodePath("…")` literal ANYWHERE in a value. */
export const NODE_PATH_LITERAL_ANYWHERE_RE = new RegExp(NODE_PATH_BODY);

/** A whole value that is one plain quoted string, capturing the body. */
const QUOTED_STRING_RE = /^"([^"]*)"$/;

/**
 * The path a NodePath SLOT stores from this value, or null when it stores none:
 * the `NodePath("…")` literal, or the bare `"…"` string `can_convert_strict`
 * converts (`variant.cpp:746-749`: `case NODE_PATH: valid[] = { STRING, NIL }`),
 * which `Variant::operator NodePath()` (`:2001`) builds the path from. A
 * StringName is not in that list, so `&"…"` is null here.
 *
 * `NodePath("")` yields `''`, not null: an empty path is a real serialised value with
 * its own meaning (unset), and collapsing it into "not a NodePath" is what let an
 * explicitly cleared key take an absent key's default.
 *
 * Neither form decodes escapes: `[^"]*` reads the body as written, which is
 * what every resolver of the result compares against.
 */
export function nodePathLiteral(raw: string): string | null {
  const value = raw.trim();
  return NODE_PATH_LITERAL_RE.exec(value)?.[1] ?? QUOTED_STRING_RE.exec(value)?.[1] ?? null;
}

/**
 * The element type Godot names inside `Array[T]([…])` for each packed type.
 *
 * The GETTER decides the spelling that reaches the file: a `TypedArray<T>`
 * behind a `PropertyInfo(Variant::PACKED_*, …)` serialises through the
 * `is_typed()` branch (`variant_parser.cpp:2341-2344`) and writes `Array[T]([…])`
 * rather than the declared packed name.
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
 * The three spellings a packed slot accepts, packed form first.
 *
 * `can_convert_strict` lists ARRAY as a valid source for every PACKED_* type
 * (`variant.cpp:467-473`) and the write converts, so the bare `[…]` literal
 * loads into a genuinely packed slot — measured on 4.6.3: `filters = ["*.png"]`
 * stores a PackedStringArray, `points = [Vector2(0, 0), Vector2(5, 5)]` a
 * PackedVector2Array, `split_offsets = Array[int]([3, 7])` a PackedInt32Array.
 *
 * The BODIES differ between them and the caller must read them differently: the
 * packed constructor takes a FLAT argument list (`PackedVector2Array(x, y, x, y)`,
 * divided by the group size at `variant_parser.cpp:1555`), while the other two
 * hold one ELEMENT each (`[Vector2(0, 0), …]`). `[0]` is the packed form, so a
 * caller can test the match index to know which body it has.
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
  /** The packed constructor's FLAT argument list, rather than one element per comma. */
  flat: boolean;
  body: string;
}

/**
 * The body of `value` under whichever of {@link packedArrayForms} matches it, or
 * null when none does.
 *
 * Takes the forms rather than a type name so a reader keeps the three RegExps at
 * module scope, and turns the packed form's match INDEX into the flag the caller
 * actually branches on — the one fact every reader of a packed slot needs and
 * the one each of them was restating.
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
