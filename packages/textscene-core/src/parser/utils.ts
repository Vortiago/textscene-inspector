export interface ParsedHeading {
  type: string;
  attributes: Record<string, string>;
}

/**
 * Scan one attribute value starting at `pos` in `str`.  Returns the value
 * substring and the index where the *next* character (whitespace, `=`, or `]`)
 * begins.  Handles five forms:
 *
 * | First char | Form                | Strategy                        |
 * |------------|---------------------|---------------------------------|
 * | `"`        | Quoted string       | Walk, skip `\`, stop at `"`     |
 * | `[`        | Bracketed array     | Depth-count `[]`, `inString`    |
 * | `(`        | Constructor         | depth-count `()`, `inString`    |
 * | letter/dig | Constructor or bare | Detect `Name(...)` then paren-balance; else to whitespace |
 * | other      | Bare token          | Walk to whitespace              |
 */
function scanHeadingValue(str: string, pos: number): { value: string; nextPos: number } {
  let i = pos;
  const len = str.length;

  // skip leading whitespace (shouldn't be any, but be safe)
  while (i < len && str[i] === ' ') i++;
  if (i >= len) return { value: '', nextPos: i };

  const first = str[i];

  // Quoted string
  if (first === '"') {
    let start = i;
    i++; // skip opening quote
    while (i < len) {
      if (str[i] === '\\') {
        i += 2; // skip escaped char
        continue;
      }
      if (str[i] === '"') {
        i++; // include closing quote
        return { value: str.slice(start, i), nextPos: i };
      }
      i++;
    }
    // unterminated — return everything from here
    return { value: str.slice(start), nextPos: len };
  }

  // Bracketed array `[...]`
  if (first === '[') {
    let start = i;
    let depth = 0;
    let inString = false;
    while (i < len) {
      const c = str[i];
      if (inString) {
        if (c === '\\') {
          i += 2; // skip backslash and escaped character
          continue;
        }
        if (c === '"') inString = false;
        i++;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === '[') depth++;
      else if (c === ']') {
        depth--;
        if (depth === 0) {
          i++; // include closing bracket
          return { value: str.slice(start, i), nextPos: i };
        }
      }
      i++;
    }
    return { value: str.slice(start), nextPos: len };
  }

  // Constructor call or bare token: scan the identifier, then peek for `(`
  let start = i;
  while (i < len) {
    const code = str.charCodeAt(i);
    if (code === 40 /* '(' */) break;
    if (!((code >= 97 && code <= 122) || (code >= 65 && code <= 90) || (code >= 48 && code <= 57) || code === 95)) break;
    i++;
  }
  const identEnd = i;

  // skip whitespace after identifier
  while (i < len && str[i] === ' ') i++;

  // check for constructor call
  if (i < len && str[i] === '(') {
    let depth = 0;
    let inString = false;
    while (i < len) {
      const c = str[i];
      if (inString) {
        if (c === '\\') {
          i += 2; // skip backslash and escaped character
          continue;
        }
        if (c === '"') inString = false;
        i++;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === '(') depth++;
      else if (c === ')') {
        depth--;
        if (depth === 0) {
          i++; // include closing paren
          return { value: str.slice(start, i), nextPos: i };
        }
      }
      i++;
    }
    // unterminated constructor — return everything from identifier start
    return { value: str.slice(start), nextPos: len };
  }

  // Bare token — value starts at `start`, ends at first whitespace/`=/`]`
  // (the closing `]` of the heading was already stripped)
  return { value: str.slice(start, identEnd), nextPos: identEnd };
}

export function parseHeading(line: string): ParsedHeading | null {
  const trimmed = line.trim();

  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return null;
  }

  const content = trimmed.slice(1, -1).trim();

  const spaceIndex = content.indexOf(' ');
  if (spaceIndex === -1) {
    return { type: content, attributes: {} };
  }

  const type = content.slice(0, spaceIndex);
  const attributesStr = content.slice(spaceIndex + 1);

  const attributes: Record<string, string> = {};
  let pos = 0;
  const len = attributesStr.length;

  while (pos < len) {
    // skip whitespace
    while (pos < len && attributesStr[pos] === ' ') pos++;
    if (pos >= len) break;

    // scan key: [^\s=]+
    let keyStart = pos;
    while (pos < len && attributesStr[pos] !== '=' && attributesStr[pos] !== ' ') pos++;
    const key = attributesStr.slice(keyStart, pos);
    if (!key) break;

    // skip whitespace before =
    while (pos < len && attributesStr[pos] === ' ') pos++;
    if (pos >= len || attributesStr[pos] !== '=') break;
    pos++; // skip '='

    // skip whitespace after =
    while (pos < len && attributesStr[pos] === ' ') pos++;
    if (pos >= len) break;

    // scan value
    const { value: rawValue, nextPos } = scanHeadingValue(attributesStr, pos);
    pos = nextPos;

    if (!rawValue) continue;

    const value = unquoteString(rawValue);

    attributes[key] = value;
  }

  return { type, attributes };
}

export function parseProperty(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith(';')) {
    return null;
  }

  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  const value = trimmed.slice(equalsIndex + 1).trim();

  return { key, value };
}

export function isHeading(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('[') && trimmed.endsWith(']');
}

/**
 * The TSCN section keywords that open a real `[…]` heading. A line is only a
 * genuine section heading if its first token is one of these — unlike
 * {@link isHeading}, which also matches BBCode tags (`[center]`, `[u]…[/u]`)
 * and bracketed array/dict content that legitimately appear ON THEIR OWN LINE
 * inside a multi-line value. Used to decide when an unterminated multi-line
 * value should be salvaged because a new section has actually begun.
 */
const SECTION_HEADING_RE =
  /^\[(gd_scene|gd_resource|ext_resource|sub_resource|node|resource|connection|editable)\b/;

export function isSectionHeading(line: string): boolean {
  return SECTION_HEADING_RE.test(line.trim());
}

export function isComment(line: string): boolean {
  return line.trim().startsWith(';');
}

export function isEmpty(line: string): boolean {
  return line.trim().length === 0;
}

/**
 * Running state of the string/bracket-balance scan, carried forward across
 * chunks so a growing multi-line value can be scanned incrementally (each new
 * chunk visited exactly once) instead of rescanned from the start every time
 * a line is appended. `depth` counts `[`/`{` outstanding over `]`/`}`.
 */
export interface ValueScanState {
  inString: boolean;
  depth: number;
}

/** The scan state before any characters have been seen. */
export const INITIAL_SCAN_STATE: ValueScanState = { inString: false, depth: 0 };

/**
 * Advance a string/bracket-balance scan by one chunk, given the state left
 * off by the previous chunk. Scans ONLY `chunk` — O(chunk length), not the
 * length of whatever came before — so a caller accumulating a multi-line
 * value line-by-line can call this once per new line and stay O(total length)
 * overall instead of O(length^2). A `\n` line separator has no effect on
 * either `inString` or `depth`, so it is safe to scan each raw line on its own
 * without the joining newline present.
 */
export function scanValueChunk(chunk: string, state: ValueScanState): ValueScanState {
  let { inString, depth } = state;
  for (let i = 0; i < chunk.length; i++) {
    const c = chunk[i];
    if (inString) {
      if (c === '\\') i++; // skip the escaped character
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
  }
  return { inString, depth };
}

/** True when a scan state reflects an unterminated string or unbalanced brackets. */
export function isIncompleteState(state: ValueScanState): boolean {
  return state.inString || state.depth > 0;
}

/**
 * True when a property value isn't complete on this line. Godot writes
 * multi-line values both as unterminated strings (label text) AND as bracketed
 * arrays/dicts spanning lines — packed arrays and especially `SpriteFrames`
 * `animations = [{ … }]`. The line-based parsers must keep accumulating until
 * BOTH quotes and brackets balance, or the value is truncated to its first
 * fragment. Single string-aware scan: incomplete if a string is still open, or
 * `[`/`{` outnumber `]`/`}` outside strings.
 *
 * A thin wrapper over {@link scanValueChunk} — full-string callers (tests,
 * and the single-line check on a property's first line) don't need to carry
 * scan state across calls, so this scans `value` from {@link INITIAL_SCAN_STATE}
 * in one shot. The multi-line accumulation hot path in `TscnParserCore`
 * carries the state forward itself instead of calling this repeatedly on a
 * growing string (that would reintroduce the O(length^2) rescan).
 */
export function isIncompleteValue(value: string): boolean {
  return isIncompleteState(scanValueChunk(value, INITIAL_SCAN_STATE));
}

const ESCAPE_MAP: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  n: '\n',
  r: '\r',
  t: '\t',
};

/**
 * Strip a value's surrounding quotes and decode Godot's string escape sequences
 * (`\n`, `\t`, `\r`, `\\`, `\"`, plus `\uXXXX` / `\UXXXXXX` Unicode — Godot emits
 * those for non-ASCII characters). Non-quoted values pass through unchanged.
 * A single left-to-right pass so an escaped backslash (`\\u1234`) is decoded as
 * `\` + literal `u1234`, not as a Unicode escape. Used wherever a node parser
 * reads a string property (label/button text, …).
 */
export function unquoteString(value: string): string {
  let v = value;
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    v = v.slice(1, -1);
  }
  return v.replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{6}|["\\nrt])/g, (_match, seq: string) => {
    if (seq[0] === 'u' || seq[0] === 'U') {
      return String.fromCodePoint(parseInt(seq.slice(1), 16));
    }
    return ESCAPE_MAP[seq] ?? seq;
  });
}

/**
 * Whether a `[node]` heading OVERRIDES the node already at its path rather than
 * declaring a new one.
 *
 * Godot writes an override with neither `type=` nor `instance=` — the node it
 * names already exists inside instanced content, so there is nothing to declare,
 * only properties to change. `[node name="Robot" parent="Player/Skeleton/Skeleton3D"]`
 * retextures a mesh inside a GLB; `[node name="CoinCount" type="Label3D" parent="..."]`
 * beside it adds a genuinely new child.
 *
 * Lives here rather than in either node creator because BOTH of them build
 * nodes from a heading — the renderer's registry and the linter's strict parser
 * — and the two disagreeing about what an override is would be a silent
 * divergence between what renders and what lints.
 */
export function isPropertyOverrideHeading(heading: ParsedHeading): boolean {
  return (
    heading.type === 'node' && !heading.attributes.type && !heading.attributes.instance
  );
}
