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
 * a fourth ("`\s*` for the reason `NODE_PATH_REGEX` documents") while not matching it,
 * and the split let the linter accept a padded `SubResource ("id")` that the animation
 * and curve parsers then dropped on the floor. Derivation makes that divergence
 * unrepresentable instead of merely discouraged.
 */
const WS = '\\s*';

/** A `NodePath("…")` literal, capturing the path. An EMPTY path is legal and common. */
const NODE_PATH_BODY = `NodePath${WS}\\(${WS}"([^"]*)"${WS}\\)`;

/** A resource reference, capturing the kind and then the id. */
const RESOURCE_REF_BODY = `(SubResource|ExtResource)${WS}\\(${WS}"([^"]+)"${WS}\\)`;

/**
 * A `SubResource("…")` reference alone, capturing the id.
 *
 * Exported as a STRING, not a RegExp, for the one caller that embeds it in a larger
 * alternation: a shared `g`-flagged instance carries `lastIndex` between calls, so
 * handing one out would make two unrelated scans interfere.
 */
export const SUB_RESOURCE_REF_BODY = `SubResource${WS}\\(${WS}"([^"]+)"${WS}\\)`;

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
