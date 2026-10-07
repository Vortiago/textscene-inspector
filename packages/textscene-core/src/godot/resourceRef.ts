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

/** The token every `ExtResource(…)` call spells, so a value without it names no id. */
const EXT_RESOURCE_TOKEN = 'ExtResource';

/** The token both reference kinds spell, so a value without it names no resource. */
const RESOURCE_TOKEN = 'Resource';

/** One reference, read in place by {@link loadedRefSpans}. Sticky, so it matches only where it is set. */
const RESOURCE_REF_AT_RE = new RegExp(RESOURCE_REF_BODY, 'y');

/** A character that continues an identifier, so `MyExtResource(` is not the `ExtResource` token. */
const IDENTIFIER_CHAR_RE = /[A-Za-z0-9_]/;

/** A reference and the span it fills in the text it was read from, `end` exclusive. */
export interface ResourceRefSpan extends ResourceRef {
  start: number;
  end: number;
}

/**
 * Every reference the loader resolves in `text`, in order, pushed onto `spans`. It resolves each
 * one as it tokenises (`resource_format_text.cpp:125-151`), but never text inside a string or a
 * `StringName`, whose quotes `get_token` reads with `\\` escapes and across lines
 * (`variant_parser.cpp:265-300`), nor a `;` comment to the end of its line (`:214`).
 *
 * @param inString whether `text` starts inside a string an earlier line opened
 * @returns whether `text` ends inside a string
 */
function scanLoadedRefs(text: string, inString: boolean, spans: ResourceRefSpan[]): boolean {
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === '\\') i++;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === ';') {
      const lineEnd = text.indexOf('\n', i);
      if (lineEnd === -1) break;
      i = lineEnd;
      continue;
    }
    if ((char !== 'E' && char !== 'S') || (i > 0 && IDENTIFIER_CHAR_RE.test(text[i - 1]!))) continue;
    RESOURCE_REF_AT_RE.lastIndex = i;
    const match = RESOURCE_REF_AT_RE.exec(text);
    if (!match) continue;
    const end = RESOURCE_REF_AT_RE.lastIndex;
    spans.push({ kind: match[1] as ResourceRef['kind'], id: refId(match[2], match[3]), start: i, end });
    i = end - 1;
  }
  return inString;
}

/** Every reference the loader resolves in one value, as {@link scanLoadedRefs} reads it. */
function loadedRefSpans(text: string): ResourceRefSpan[] {
  const spans: ResourceRefSpan[] = [];
  scanLoadedRefs(text, false, spans);
  return spans;
}

/**
 * The references the loader resolves on each line of a file, as {@link scanLoadedRefs} reads them.
 * A string carries over to the next line, so an editor reads the whole file, not one line.
 */
export function resourceRefSpansByLine(lines: readonly string[]): ResourceRefSpan[][] {
  let inString = false;
  return lines.map((line) => {
    const spans: ResourceRefSpan[] = [];
    inString = scanLoadedRefs(line, inString, spans);
    return spans;
  });
}

/** The id of every `ExtResource(…)` in a value, in order, as {@link loadedRefSpans} reads them. */
export function extResourceIdsIn(text: string): string[] {
  // Most values name no resource, and the walk reads every character of a multi-megabyte array.
  if (!text.includes(EXT_RESOURCE_TOKEN)) return [];
  return loadedRefSpans(text)
    .filter((span) => span.kind === 'ExtResource')
    .map((span) => span.id);
}

/**
 * `text` with the id of every reference the loader resolves replaced by `newId`'s answer, each
 * written in the tight form. Text inside a string stays as written, as {@link loadedRefSpans} reads it.
 */
export function renameResourceRefs(text: string, newId: (ref: ResourceRef) => string): string {
  if (!text.includes(RESOURCE_TOKEN)) return text;
  let renamed = '';
  let copiedTo = 0;
  for (const span of loadedRefSpans(text)) {
    renamed += `${text.slice(copiedTo, span.start)}${span.kind}("${newId(span)}")`;
    copiedTo = span.end;
  }
  return renamed + text.slice(copiedTo);
}

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

/** An open reference at the end of a text, `[1]` its kind and `[2]` the id typed so far. */
const OPEN_RESOURCE_REF_RE = new RegExp(`(SubResource|ExtResource)${WS}\\(${WS}"([^"]*)$`);

/** The reference a text ends inside, with the quoted id typed so far, or null. An editor completes the id. */
export function openResourceRef(text: string): ResourceRef | null {
  const match = OPEN_RESOURCE_REF_RE.exec(text);
  return match ? { kind: match[1] as ResourceRef['kind'], id: match[2]! } : null;
}

/** `Resource("…")` with one quoted argument, or two: `[1]` and `[2]`. */
const PATH_RESOURCE_RE = new RegExp(`^Resource${WS}\\(${WS}"([^"]*)"(?:${WS},${WS}"([^"]*)")?${WS}\\)$`);

/**
 * Whether a whole value is `Resource("path")`. The text loader sets no `rp.func`, so the parser's
 * generic branch loads it by path (`variant_parser.cpp:1123-1185`). A second argument pairs one
 * `uid://` with one path and refuses two of either (`:1141-1152`). Whether the path loads is a rule's question.
 */
export function isPathResourceLiteral(raw: string): boolean {
  const match = PATH_RESOURCE_RE.exec(raw);
  if (!match) return false;
  const second = match[2];
  if (second === undefined) return true;
  return match[1]!.startsWith('uid://') !== second.startsWith('uid://');
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
