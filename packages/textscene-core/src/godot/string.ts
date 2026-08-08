/** `String`'s parsing behaviour, as the engine defines it. */

/**
 * The spelling `String::is_valid_int()` accepts: an optional single sign, then
 * digits, and nothing else.
 *
 * The sign class is `[+-]?`, not `-?`. A leading `+` is a real spelling Godot
 * reads, and admitting it in one regex while a sibling rejects it has already
 * cost a false positive here: a `settings/+0/…` key entered no index map and its
 * sibling reported a write the engine applies.
 *
 * NOT the same as `to_int()`, which is the other of Godot's two integer parses:
 * `to_int` SKIPS non-digits rather than stopping at them (`ustring.cpp:2268-2298`),
 * so `"x"` reads as 0 and `"a1b2"` as 12, and text this regex rejects still
 * resolves to a number under it. Which parse a class uses decides whether a
 * non-numeric index is a dropped write or a landed one, so never substitute one
 * for the other — see `indexedFamilyValidator`'s `indexParse` option.
 *
 * No `g` flag, so `.test()` on the shared instance is stateless.
 */
export const IS_VALID_INT_RE = /^[+-]?\d+$/;

/**
 * Depth/quote-aware split of a bracket body's top-level comma-separated
 * elements, so a comma inside a nested literal or a quoted resource id is never
 * mistaken for a separator. Empty input yields no elements.
 *
 * `(`/`[` both open a level and `)`/`]` both close one, because Godot's own
 * writer nests the two interchangeably — `Array[NodePath]([NodePath("a"),
 * NodePath("b")])` puts a paren body inside a bracket body. Inside a quoted
 * run, a backslash escapes the next character, so an embedded `\"` does not
 * end the quote.
 */
export function splitTopLevel(body: string): string[] {
  const trimmed = body.trim();
  if (trimmed === '') return [];
  const parts: string[] = [];
  let depth = 0;
  let inQuote = false;
  let start = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (inQuote) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === '"') inQuote = false;
      continue;
    }
    if (c === '"') {
      inQuote = true;
    } else if (c === '(' || c === '[') {
      depth++;
    } else if (c === ')' || c === ']') {
      depth--;
    } else if (c === ',' && depth === 0) {
      parts.push(trimmed.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(trimmed.slice(start));
  return parts.map((p) => p.trim());
}
