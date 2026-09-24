/**
 * `SubResource(…)` / `ExtResource(…)` references: the one grammar, and every reader of its captures.
 * No caller sees a capture index, so the grammar and its readers change in one file.
 * `variant_parser.cpp:1089-1093` asks only for the next token to be `(`, and `get_token` drops every
 * character `<= 32` before a token (`:415-417`), so `SubResource ( "id" )` loads like the tight form.
 */

const WS = '\\s*';

/**
 * The id argument: `[1]` a quoted id, or `[2]` the old-style integer index. The loader takes `TK_NUMBER` as well as `TK_STRING`
 * (`resource_format_text.cpp:107`, `:128`) and stringifies it, as the header's `id=` is (`:488`, `:1048`), so `id=1` and `ExtResource(1)` meet as "1".
 * Unsigned digits only: the `-`/fraction/exponent numbers `get_token` also reads (`variant_parser.cpp:419-486`) never named an index.
 * `[^"]+`, not `[\w-]+`: every resolver reads the quoted body as written, so a narrower class makes the linter stricter than they are.
 */
const RESOURCE_ID = `(?:"([^"]+)"|(\\d+))`;

/** `[1]` the kind, then the two id captures of {@link RESOURCE_ID}. */
const RESOURCE_REF_BODY = `(SubResource|ExtResource)${WS}\\(${WS}${RESOURCE_ID}${WS}\\)`;

/** The two id captures of {@link RESOURCE_ID} alone. */
const SUB_RESOURCE_REF_BODY = `SubResource${WS}\\(${WS}${RESOURCE_ID}${WS}\\)`;

const RESOURCE_REF_RE = new RegExp(`^${RESOURCE_REF_BODY}$`);
const SUB_RESOURCE_REF_ANYWHERE_RE = new RegExp(SUB_RESOURCE_REF_BODY);

/**
 * `"key": SubResource(…)` entries of a serialised Dictionary. An empty key is
 * legal (AnimationPlayer's default library is `""`). Shared `g` instance: only
 * `matchAll` reads it, which clones before scanning.
 */
const DICT_SUB_RESOURCE_ENTRY_RE = new RegExp(`"([^"]*)"${WS}:${WS}${SUB_RESOURCE_REF_BODY}`, 'g');

/**
 * An `ExtResource(` call anywhere in a value: a discriminator, not a parse, for a caller asking only
 * whether the value reaches outside the file. It stops at the `(` because a suppression check wants
 * the superset of every id spelling.
 */
export const EXT_RESOURCE_CALL_ANYWHERE_RE = new RegExp(`ExtResource${WS}\\(`);

/** The kind and id of a resource reference. */
export interface ResourceRef {
  kind: 'SubResource' | 'ExtResource';
  id: string;
}

/**
 * The id the two captures of {@link RESOURCE_ID} spell. Exactly one is set. Digits stay as written,
 * which is what the heading scanner stores for the header's `id=`.
 */
function refId(quoted: string | undefined, digits: string | undefined): string {
  return quoted ?? digits!;
}

/** The reference a whole value is, or null when it is not one. */
export function resourceRef(raw: string): ResourceRef | null {
  const match = RESOURCE_REF_RE.exec(raw);
  if (!match) return null;
  return { kind: match[1] as ResourceRef['kind'], id: refId(match[2], match[3]) };
}

/** The id of the first `SubResource(…)` anywhere in `text`, or null. */
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
 * A reader of the reference literal held by `"key"` of a Dictionary value, null when the field is
 * absent or holds none. The literal, not the id, for a reader that hands it to {@link resourceRef}
 * later. It keeps the padding tolerance of every reader here: without it a SpriteFrames animation
 * loses frames. A builder, so the caller keeps one instance per key at module scope.
 */
export function keyedResourceRefReader(key: string): (text: string) => string | null {
  const re = new RegExp(`"${key}"${WS}:${WS}(${RESOURCE_REF_BODY})`);
  return (text) => re.exec(text)?.[1] ?? null;
}
