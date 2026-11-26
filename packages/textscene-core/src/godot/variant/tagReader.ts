import { ParseError, Tokens, ValueReader, type ParseErrorCode } from './strToVar.js';

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

/** A tag that stops: Godot's message, its code and line, and the name and fields read before it. */
export interface RefusedTag {
  readonly name: string | undefined;
  readonly error: string;
  readonly code: ParseErrorCode;
  readonly line: number;
  readonly fields: readonly TagField[];
}

/** The name and fields read so far, kept so a refusal can report them. */
interface TagDraft {
  name?: string;
  fields: TagField[];
}

/** `parse_tag` from `start`, on line `line` (variant_parser.cpp:1874). Null at the end, as `ERR_FILE_EOF`. */
export function readTag(text: string, start: number, line: number): ReadTag | RefusedTag | null {
  const tokens = new Tokens(text, start, line);
  const tag: TagDraft = { fields: [] };
  try {
    const open = tokens.next();
    if (open.kind === 'eof') return null;
    if (open.kind !== 'bracketOpen') throw new ParseError("Expected '['");
    readBody(tokens, tag);
    return { name: tag.name!, fields: tag.fields, end: tokens.offset, endLine: tokens.line };
  } catch (error) {
    if (!(error instanceof ParseError)) throw error;
    return { name: tag.name, error: error.message, code: error.code, line: tokens.line, fields: tag.fields };
  }
}

/** `_parse_tag` after its `[`, writing the name and each field into `tag` as it reads them. */
function readBody(tokens: Tokens, tag: TagDraft): void {
  // An id reads as `ext_func` reads it, a string or an old-style number: `ExtResource( 1 )` parses.
  const values = new ValueReader(tokens, { resourceOf: () => null });
  const first = tokens.next();
  if (first.kind !== 'identifier') throw new ParseError('Expected identifier (tag name)');
  tag.name = first.text;
  // `[someprop.Android]`: a `.` or a `:` right after the name joins the next identifier to it.
  let isNaming = true;
  for (;;) {
    if (tokens.isEof)
      throw new ParseError(`Unexpected EOF while parsing tag '${tag.name}'`, 'ERR_FILE_CORRUPT');
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
