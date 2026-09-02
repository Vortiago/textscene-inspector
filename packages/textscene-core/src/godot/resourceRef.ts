/**
 * `SubResource(…)` / `ExtResource(…)` references: the one grammar, and every
 * reader of its captures.
 *
 * No caller sees a capture index. A reader that indexed `[2]` of one copy and
 * `[1]` of another is how a widened grammar shipped with readers still on the
 * old shape; here the grammar and its readers move in one file.
 *
 * `variant_parser.cpp:1089-1093` takes the three identifiers into the
 * reference arm and then asks only for the next token to be `(`, and
 * `get_token` discards every character `<= 32` before a token (`:415-417`), so
 * `SubResource ( "id" )` loads exactly like the tight form.
 */

const WS = '\\s*';

/**
 * The id argument: `[1]` a quoted id, or `[2]` the old-style integer index.
 *
 * `_parse_sub_resource` and `_parse_ext_resource` take `TK_NUMBER` as well as
 * `TK_STRING` (`resource_format_text.cpp:107`, `:128` — "Expected number (old
 * style sub-resource index) or string") and `String id = token.value`
 * stringifies the int; the header side reads `String id =
 * next_tag.fields["id"]` (`:488`, `:1048`), so `id=1` and `ExtResource(1)`
 * meet as the string "1". The digits are kept as written, which is what the
 * heading scanner stores for the header's `id=`.
 *
 * Unsigned digits only: the old-style index is a non-negative int, and the
 * `-`/fraction/exponent spellings `get_token` also reads as a number
 * (`variant_parser.cpp:419-486`) never named one.
 *
 * `[^"]+` rather than `[\w-]+` for the quoted form: every resolver that later
 * LOOKS the id up reads the quoted body as written, and a narrower class here
 * made the linter the strictest reader of an id it does not itself resolve.
 */
const RESOURCE_ID = `(?:"([^"]+)"|(\\d+))`;

/** `[1]` the kind, then the two id captures of {@link RESOURCE_ID}. */
const RESOURCE_REF_BODY = `(SubResource|ExtResource)${WS}\\(${WS}${RESOURCE_ID}${WS}\\)`;

/** The two id captures of {@link RESOURCE_ID} alone. */
const SUB_RESOURCE_REF_BODY = `SubResource${WS}\\(${WS}${RESOURCE_ID}${WS}\\)`;

const RESOURCE_REF_RE = new RegExp(`^${RESOURCE_REF_BODY}$`);
const SUB_RESOURCE_REF_ANYWHERE_RE = new RegExp(SUB_RESOURCE_REF_BODY);

/**
 * `"key": SubResource(…)` entries of a serialised Dictionary; an EMPTY key is
 * legal (AnimationPlayer's default library is `""`). Shared `g` instance: only
 * `matchAll` reads it, which clones before scanning.
 */
const DICT_SUB_RESOURCE_ENTRY_RE = new RegExp(`"([^"]*)"${WS}:${WS}${SUB_RESOURCE_REF_BODY}`, 'g');

/**
 * An `ExtResource(` call ANYWHERE in a value — a discriminator, not a parse.
 *
 * For a caller asking only "does this value reach outside the file", where the
 * id is nobody's business. The body stops at the `(` because a SUPPRESSION
 * check wants the superset of every id spelling.
 */
export const EXT_RESOURCE_CALL_ANYWHERE_RE = new RegExp(`ExtResource${WS}\\(`);

/** The kind and id of a resource reference. */
export interface ResourceRef {
  kind: 'SubResource' | 'ExtResource';
  id: string;
}

/** The id the two captures of {@link RESOURCE_ID} spell; exactly one is set. */
function refId(quoted: string | undefined, digits: string | undefined): string {
  return quoted ?? digits!;
}

/** The reference a WHOLE value is, or null when it is not one. */
export function resourceRef(raw: string): ResourceRef | null {
  const match = RESOURCE_REF_RE.exec(raw);
  if (!match) return null;
  return { kind: match[1] as ResourceRef['kind'], id: refId(match[2], match[3]) };
}

/** The id of the first `SubResource(…)` ANYWHERE in `text`, or null. */
export function subResourceRefAnywhere(text: string): string | null {
  const match = SUB_RESOURCE_REF_ANYWHERE_RE.exec(text);
  return match ? refId(match[1], match[2]) : null;
}

/** Every `"key": SubResource(…)` entry of a Dictionary value, in order. */
export function dictSubResourceEntries(text: string): Array<{ key: string; id: string }> {
  const entries: Array<{ key: string; id: string }> = [];
  for (const match of text.matchAll(DICT_SUB_RESOURCE_ENTRY_RE)) {
    entries.push({ key: match[1]!, id: refId(match[2], match[3]) });
  }
  return entries;
}

/**
 * A reader of the reference LITERAL held by `"key"` of a Dictionary value,
 * null when the field is absent or holds none. The literal rather than the
 * id, for a reader that stores references un-decoded and hands them to
 * {@link resourceRef} later. Same padding tolerance as every reader here — a
 * hand-rolled copy dropped it and a SpriteFrames animation lost half its
 * frames. A builder, so the caller keeps one instance per key at module scope.
 */
export function keyedResourceRefReader(key: string): (text: string) => string | null {
  const re = new RegExp(`"${key}"${WS}:${WS}(${RESOURCE_REF_BODY})`);
  return (text) => re.exec(text)?.[1] ?? null;
}
