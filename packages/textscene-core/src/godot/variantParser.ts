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
 * A resource reference, capturing the kind and then the id.
 *
 * The id class is `[^"]+`, matching every resolver that later LOOKS the id up. A copy
 * reading `[\w-]+` made the linter the strictest reader of an id it does not itself
 * resolve, rejecting references the rest of the pipeline handles.
 */
const RESOURCE_REF_BODY = `(SubResource|ExtResource)${WS}\\(${WS}"([^"]+)"${WS}\\)`;

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
 * A whole `Packed…Array(…)` constructor call, capturing the argument body.
 *
 * Built rather than written out for the reason this file exists: five copies of
 * this shape had been hand-written across the tile decoder, the GridMap parser
 * and the shape resources, none of them tolerating the padding Godot's
 * tokenizer discards, so a hand-edited `PackedByteArray ( … )` decoded to
 * nothing and a TileMapLayer silently rendered no tiles.
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
 * A field of a serialised Dictionary whose value is a resource reference;
 * `[1]` is the whole reference. Same padding tolerance as every other builder
 * here — a hand-rolled copy dropped it and a SpriteFrames animation lost half
 * its frames.
 */
export function dictRefField(key: string, global = false): RegExp {
  return new RegExp(`"${key}"${WS}:${WS}(${RESOURCE_REF_BODY})`, global ? 'g' : '');
}

/**
 * A `SubResource("…")` reference alone, capturing the id.
 *
 * Exported as a STRING, not a RegExp, for the one caller that embeds it in a larger
 * alternation: a shared `g`-flagged instance carries `lastIndex` between calls, so
 * handing one out would make two unrelated scans interfere.
 */
export const SUB_RESOURCE_REF_BODY = `SubResource${WS}\\(${WS}"([^"]+)"${WS}\\)`;

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

/** A value that is EXACTLY a `NodePath("…")` literal. No `g` flag, so `.test()` is stateless. */
export const NODE_PATH_LITERAL_RE = new RegExp(`^${NODE_PATH_BODY}$`);

/** The first `NodePath("…")` literal ANYWHERE in a value. */
export const NODE_PATH_LITERAL_ANYWHERE_RE = new RegExp(NODE_PATH_BODY);

/** A value that is EXACTLY a resource reference: `[1]` is the kind, `[2]` the id. */
export const RESOURCE_REF_RE = new RegExp(`^${RESOURCE_REF_BODY}$`);

/** The first `SubResource("…")` ANYWHERE in a value; `[1]` is the id. */
export const SUB_RESOURCE_REF_ANYWHERE_RE = new RegExp(SUB_RESOURCE_REF_BODY);

/**
 * The path inside a `NodePath("…")` literal, or null when the value is not one.
 *
 * `NodePath("")` yields `''`, not null: an empty path is a real serialised value with
 * its own meaning (unset), and collapsing it into "not a NodePath" is what let an
 * explicitly cleared key take an absent key's default.
 */
export function nodePathLiteral(raw: string): string | null {
  return NODE_PATH_LITERAL_RE.exec(raw)?.[1] ?? null;
}

/** The kind and id of a resource reference, or null when the value is not one. */
export function resourceRef(
  raw: string
): { kind: 'SubResource' | 'ExtResource'; id: string } | null {
  const match = RESOURCE_REF_RE.exec(raw);
  if (!match) return null;
  return { kind: match[1] as 'SubResource' | 'ExtResource', id: match[2]! };
}
