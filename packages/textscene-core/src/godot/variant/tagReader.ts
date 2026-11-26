import { GodotError, ParseError, type ParseErrorCode } from './parseError.js';
import { Tokens, ValueReader, type VariantReading } from './strToVar.js';

/** A field value as written: its source span, and the line Godot's counter stands on at its first token. */
export interface TagField {
  readonly key: string;
  readonly start: number;
  readonly end: number;
  readonly line: number;
}

/** A tag that reads: its name, its fields in order, the offset just past its `]`, and Godot's line there. */
export interface ReadTag {
  readonly name: string;
  readonly fields: readonly TagField[];
  readonly end: number;
  readonly endLine: number;
}

/** A tag that stops: Godot's message, code and line, what it read, and the offset of its last token. */
export interface RefusedTag {
  readonly name: string | undefined;
  readonly error: string;
  readonly code: ParseErrorCode;
  readonly line: number;
  readonly fields: readonly TagField[];
  readonly stop: number;
}

/** The name and fields read so far, kept so a refusal can report them. */
interface TagDraft {
  name?: string;
  fields: TagField[];
}

/** The resource parser of each tag after the header: an id reads as `ext_func` reads it. */
export const SECTION_READING: VariantReading = { resourceOf: () => null };

/** The header's: it has none (resource_format_text.cpp:1131), so a reference reads as a `Resource()` path. */
export const HEADER_READING: VariantReading = {};

/** `parse_tag` from `start`, on line `line` (variant_parser.cpp:1874). Null at the end, as `ERR_FILE_EOF`. */
export function readTag(
  text: string,
  start: number,
  line: number,
  reading: VariantReading
): ReadTag | RefusedTag | null {
  const tokens = new Tokens(text, start, line);
  const tag: TagDraft = { fields: [] };
  try {
    const open = tokens.next();
    if (open.kind === 'eof') return null;
    if (open.kind !== 'bracketOpen') throw new ParseError("Expected '['");
    readBody(tokens, new ValueReader(tokens, reading), tag);
    return { name: tag.name!, fields: tag.fields, end: tokens.offset, endLine: tokens.line };
  } catch (error) {
    if (!(error instanceof ParseError)) throw error;
    const { message, code } = error;
    return {
      name: tag.name,
      error: message,
      code,
      line: tokens.line,
      fields: tag.fields,
      stop: tokens.tokenStart.offset,
    };
  }
}

/** `_parse_tag` after its `[`, writing the name and each field into `tag` as it reads them. */
function readBody(tokens: Tokens, values: ValueReader, tag: TagDraft): void {
  const first = tokens.next();
  if (first.kind !== 'identifier') throw new ParseError('Expected identifier (tag name)');
  tag.name = first.text;
  // `[someprop.Android]`: a `.` or a `:` right after the name joins the next identifier to it.
  let isNaming = true;
  for (;;) {
    if (tokens.isEof)
      throw new ParseError(`Unexpected EOF while parsing tag '${tag.name}'`, GodotError.FileCorrupt);
    let token = tokens.next();
    if (token.kind === 'bracketClose') return;
    if (isNaming && (token.kind === 'period' || token.kind === 'colon')) {
      tag.name += token.kind === 'period' ? '.' : ':';
      token = tokens.next();
    } else isNaming = false;
    if (token.kind !== 'identifier') throw new ParseError('Expected identifier');
    if (isNaming) {
      tag.name += token.text;
      continue;
    }
    if (tokens.next().kind !== 'equal') throw new ParseError("Expected '=' after identifier");
    tag.fields.push(field(tokens, values, token.text));
  }
}

/** One field's value, read from the token after its `=`. */
function field(tokens: Tokens, values: ValueReader, key: string): TagField {
  const valueToken = tokens.next();
  const { offset: start, line } = tokens.tokenStart;
  values.value(valueToken);
  return { key, start, end: tokens.offset, line };
}
