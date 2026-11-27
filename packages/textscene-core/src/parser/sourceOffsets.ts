import { isEscapedNewline } from '../godot/variant/strToVar.js';
import { INITIAL_SCAN_STATE, leadingSpace, scanValueChunk, stripLineComment } from './utils.js';

/** True when line `at` ends on an odd run of backslashes with nothing, not even `\r`, before its `\n`. */
export function escapesItsNewline(content: string, lineStarts: readonly number[], at: number): boolean {
  const next = lineStarts[at + 1];
  return next !== undefined && isEscapedNewline(content, next - 1);
}

/** A field over several lines without the `;` comments the tag reader skips, so no read sits in one. */
export function withoutComments(text: string): string {
  if (!text.includes(';')) return text;
  let state = INITIAL_SCAN_STATE;
  return text
    .split('\n')
    .map((part) => {
      const code = stripLineComment(part, state.inString);
      state = scanValueChunk(code, state);
      return code;
    })
    .join('\n');
}

/** True when `line` starts with a bare key and its `=`, not a value such as `"x=y"` that holds one. */
export function opensKey(line: string): boolean {
  return /^\s*[^\s"'[\](){},=]+\s*=/.test(line);
}

/** The offset of each newline in raw `text` that Godot's counter skips. */
export function escapedNewlinesIn(text: string): number[] {
  const skipped: number[] = [];
  for (let at = text.indexOf('\n'); at >= 0; at = text.indexOf('\n', at + 1))
    if (isEscapedNewline(text, at)) skipped.push(at);
  return skipped;
}

/** The offset each line of `content` starts at, as `splitLines` splits it. */
export function lineStartsOf(content: string): number[] {
  const starts = [0];
  for (let at = content.indexOf('\n'); at !== -1; at = content.indexOf('\n', at + 1)) starts.push(at + 1);
  return starts;
}

/** Where a property line's value starts: past its `=` and the white space `parseProperty` trims. */
export function valueOffset(line: string): number {
  const afterEquals = line.indexOf('=') + 1;
  return afterEquals + leadingSpace(line.slice(afterEquals));
}

/** The 0-based line and column of `offset`, searched forward from line `from`. */
export function lineAndColumnOf(
  lineStarts: readonly number[],
  offset: number,
  from: number
): { line: number; column: number } {
  let line = from;
  while (line + 1 < lineStarts.length && lineStarts[line + 1]! <= offset) line++;
  return { line, column: offset - lineStarts[line]! };
}

/** A heading's text to its `]`, comments gone. The `]` is code, so no comment strip on its line is needed. */
export function headingText(
  lines: readonly string[],
  first: number,
  column: number,
  end: { line: number; column: number }
): string {
  // One line holds no comment before its `]`, since the tag reader skips a comment to the line's end.
  if (end.line === first) return lines[first]!.slice(column, end.column);
  const spanned = lines.slice(first, end.line + 1);
  spanned[0] = spanned[0]!.slice(column);
  spanned[spanned.length - 1] = lines[end.line]!.slice(0, end.column);
  return withoutComments(spanned.join('\n'));
}
