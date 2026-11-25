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
interface ResourceRefSpan extends ResourceRef {
  start: number;
  end: number;
}

/**
 * Each reference the loader resolves, past strings and `;` comments (variant_parser.cpp:214, :265).
 *
 * @param inString whether `text` starts inside a string an earlier line opened
 * @returns whether `text` ends inside a string
 */
function scanLoadedRefs(text: string, inString: boolean, sink: ScanSink): boolean {
  const { refs, literals } = sink;
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
    if ((char !== 'E' && char !== 'S' && char !== 'R') || (i > 0 && IDENTIFIER_CHAR_RE.test(text[i - 1]!)))
      continue;
    if (char === 'R') {
      if (literals) i = readLiteralAt(text, i, literals);
      continue;
    }
    if (!refs) continue;
    RESOURCE_REF_AT_RE.lastIndex = i;
    const match = RESOURCE_REF_AT_RE.exec(text);
    if (!match) continue;
    const end = RESOURCE_REF_AT_RE.lastIndex;
    refs.push({ kind: match[1] as ResourceRef['kind'], id: refId(match[2], match[3]), start: i, end });
    i = end - 1;
  }
  return inString;
}

/** Where {@link scanLoadedRefs} puts what it reads, null to skip a kind. */
interface ScanSink {
  refs: ResourceRefSpan[] | null;
  literals: LiteralSpan[] | null;
}

/** Every reference the loader resolves in one value, as {@link scanLoadedRefs} reads it. */
function loadedRefSpans(text: string): ResourceRefSpan[] {
  const refs: ResourceRefSpan[] = [];
  scanLoadedRefs(text, false, { refs, literals: null });
  return refs;
}

/**
 * The references the loader resolves on each line of a file, as {@link scanLoadedRefs} reads them.
 * A string carries over to the next line, so an editor reads the whole file, not one line.
 */
export function resourceRefSpansByLine(lines: readonly string[]): ResourceRefSpan[][] {
  let inString = false;
  return lines.map((line) => {
    const refs: ResourceRefSpan[] = [];
    inString = scanLoadedRefs(line, inString, { refs, literals: null });
    return refs;
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
 * renamed one written in the tight form. A reference `newId` keeps, and text inside a string,
 * stay as written, as {@link loadedRefSpans} reads them.
 */
export function renameResourceRefs(text: string, newId: (ref: ResourceRef) => string): string {
  if (!text.includes(RESOURCE_TOKEN)) return text;
  let renamed = '';
  let copiedTo = 0;
  for (const span of loadedRefSpans(text)) {
    const id = newId(span);
    if (id === span.id) continue;
    renamed += `${text.slice(copiedTo, span.start)}${span.kind}("${id}")`;
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

/** A native pre-check for a literal, as the scan reads each character. `\b` keeps out `SubResource(`. */
const PATH_RESOURCE_SOMEWHERE_RE = new RegExp(`\\b${PATH_RESOURCE_RE.source.slice(1, -1)}`);

/** One `Resource(…)` literal, read in place by {@link scanLoadedRefs}. */
const PATH_RESOURCE_AT_RE = new RegExp(PATH_RESOURCE_RE.source.slice(1, -1), 'y');

/** A literal's read and where it starts and ends in the text it was read from, `end` exclusive. */
interface LiteralSpan {
  start: number;
  end: number;
  read: LiteralRead | RefusedRead;
}

/** The index of the literal's last character at `start`, its read pushed onto `literals`, or `start`. */
function readLiteralAt(text: string, start: number, literals: LiteralSpan[]): number {
  PATH_RESOURCE_AT_RE.lastIndex = start;
  const match = PATH_RESOURCE_AT_RE.exec(text);
  if (!match) return start;
  const args = [match[1]!, match[2]].filter((arg): arg is string => arg !== undefined);
  const uids = args.filter((arg) => arg.startsWith('uid://'));
  const paths = args.filter((arg) => !arg.startsWith('uid://'));
  const read: LiteralRead | RefusedRead =
    paths.length > 1
      ? { kind: 'Refused', twice: 'paths' }
      : uids.length > 1
        ? { kind: 'Refused', twice: 'uids' }
        : { kind: 'Resource', path: paths[0] ?? null, uid: uids[0] ?? '' };
  literals.push({ start, end: PATH_RESOURCE_AT_RE.lastIndex, read });
  return PATH_RESOURCE_AT_RE.lastIndex - 1;
}

/** A reference's id, a `Resource(…)` literal's path and its `uid://`, or a literal Godot refuses. */
export type ValueRead = ResourceRef | LiteralRead | RefusedRead;

/** A null path is a literal with only a `uid://`, which nothing here resolves. */
export type LiteralRead = { kind: 'Resource'; path: string | null; uid: string };

/** A literal with two paths or two `uid://`, at which the parse fails (`variant_parser.cpp:1141-1152`). */
export type RefusedRead = { kind: 'Refused'; twice: 'paths' | 'uids' };

/** A read and the offset whose line Godot prints for it: a reference's id, or a literal's closing `)`. */
export interface ValueReadAt {
  readonly read: ValueRead;
  readonly printedAt: number;
}

/** Each reference and `Resource(…)` literal of `text`, in the order the loader meets them. */
export function valueReadsIn(text: string): ValueRead[] {
  return valueReadsAt(text).map(({ read }) => read);
}

/** {@link valueReadsIn}, each read with the offset whose line Godot prints when it fails. */
export function valueReadsAt(text: string): ValueReadAt[] {
  // Each of the three spellings holds this word.
  if (!text.includes('Resource')) return [];
  const hasLiteral = PATH_RESOURCE_SOMEWHERE_RE.test(text);
  const refs: ResourceRefSpan[] = [];
  const literals: LiteralSpan[] = [];
  scanLoadedRefs(text, false, { refs, literals: hasLiteral ? literals : null });
  const refReads = refs.map((span) => ({
    start: span.start,
    read: { kind: span.kind, id: span.id },
    printedAt: argumentAt(text, span.start),
  }));
  const literalReads = literals.map(({ start, end, read }) => ({ start, read, printedAt: end - 1 }));
  return [...refReads, ...literalReads]
    .sort((a, b) => a.start - b.start)
    .map(({ read, printedAt }) => ({ read, printedAt }));
}

/** The offset of the first token after the `(` of the call at `start`, as `get_token` skips `<= 32`. */
function argumentAt(text: string, start: number): number {
  let at = text.indexOf('(', start) + 1;
  while (at < text.length && text.charCodeAt(at) <= 32) at++;
  return at;
}

/** The read of each `Resource(…)` literal of `text` that Godot parses, in order, each with its `uid://`. */
export function literalReadsIn(text: string): LiteralRead[] {
  if (!PATH_RESOURCE_SOMEWHERE_RE.test(text)) return [];
  const literals: LiteralSpan[] = [];
  scanLoadedRefs(text, false, { refs: null, literals });
  return literals.flatMap(({ read }) => (read.kind === 'Resource' ? [read] : []));
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
