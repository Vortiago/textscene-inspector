/**
 * `parseStructuredText` ports `TextServer::parse_structured_text` (`servers/text/text_server.cpp:2140-2290`)
 * and the CUSTOM arm of `Control::structured_text_parser` (`scene/gui/control.cpp:3523-3532`).
 * Each range is `[start, end, direction]`, as Godot's `Vector3i`.
 */
import { describe, expect, it } from 'vitest';
import { parseStructuredText } from './structuredText';
import { StructuredTextParser, TextDirection } from './textServerEnums';

const AUTO = TextDirection.TEXT_DIRECTION_AUTO;
const LTR = TextDirection.TEXT_DIRECTION_LTR;
const INHERITED = TextDirection.TEXT_DIRECTION_INHERITED;

function ranges(parser: number, text: string, options: readonly unknown[] = []) {
  return parseStructuredText(parser, options, text).map(({ start, end, direction }) => [
    start,
    end,
    direction,
  ]);
}

describe('parseStructuredText', () => {
  it('URI splits at each of `\\ / . : & = @ ? #`, one LTR range per separator', () => {
    expect(ranges(StructuredTextParser.STRUCTURED_TEXT_URI, 'a://b.c?d=e#f')).toEqual([
      [0, 1, AUTO],
      [1, 2, LTR],
      [2, 3, LTR],
      [3, 4, LTR],
      [4, 5, AUTO],
      [5, 6, LTR],
      [6, 7, AUTO],
      [7, 8, LTR],
      [8, 9, AUTO],
      [9, 10, LTR],
      [10, 11, AUTO],
      [11, 12, LTR],
      [12, 13, AUTO],
    ]);
    expect(ranges(StructuredTextParser.STRUCTURED_TEXT_URI, 'x@y&z\\w')).toEqual([
      [0, 1, AUTO],
      [1, 2, LTR],
      [2, 3, AUTO],
      [3, 4, LTR],
      [4, 5, AUTO],
      [5, 6, LTR],
      [6, 7, AUTO],
    ]);
  });

  it('FILE splits only at `\\ / :`', () => {
    expect(ranges(StructuredTextParser.STRUCTURED_TEXT_FILE, 'C:\\ab/c.txt')).toEqual([
      [0, 1, AUTO],
      [1, 2, LTR],
      [2, 3, LTR],
      [3, 5, AUTO],
      [5, 6, LTR],
      [6, 11, AUTO],
    ]);
  });

  it('EMAIL keeps the local part whole and splits the domain at each `.`', () => {
    expect(ranges(StructuredTextParser.STRUCTURED_TEXT_EMAIL, 'a.b@c.d')).toEqual([
      [0, 3, AUTO],
      [3, 4, LTR],
      [4, 5, AUTO],
      [5, 6, LTR],
      [6, 7, AUTO],
    ]);
  });

  it('LIST splits at its one string option, every part and separator INHERITED', () => {
    // A separator range follows the last part too, one past the text.
    expect(ranges(StructuredTextParser.STRUCTURED_TEXT_LIST, 'ab,c,d', [','])).toEqual([
      [2, 3, INHERITED],
      [3, 4, INHERITED],
      [4, 5, INHERITED],
      [5, 6, INHERITED],
      [6, 7, INHERITED],
    ]);
  });

  it('LIST skips a part whose character offset equals its index, as `prev != i` compares the two', () => {
    // The first part always starts at offset 0, index 0. `,a` puts the second part at offset 1, index 1.
    expect(ranges(StructuredTextParser.STRUCTURED_TEXT_LIST, ',a', [','])).toEqual([
      [0, 1, INHERITED],
      [2, 3, INHERITED],
    ]);
  });

  it('LIST without exactly one string option gives no range', () => {
    expect(ranges(StructuredTextParser.STRUCTURED_TEXT_LIST, 'a,b')).toEqual([]);
    expect(ranges(StructuredTextParser.STRUCTURED_TEXT_LIST, 'a,b', [',', ';'])).toEqual([]);
    expect(ranges(StructuredTextParser.STRUCTURED_TEXT_LIST, 'a,b', [1])).toEqual([]);
  });

  it('GDSCRIPT splits identifiers, string literals with escapes, and a `#` comment', () => {
    expect(ranges(StructuredTextParser.STRUCTURED_TEXT_GDSCRIPT, 'x = "a\\"b" # c')).toEqual([
      [0, 1, AUTO],
      [1, 4, AUTO],
      [4, 5, LTR],
      [5, 9, AUTO],
      [9, 10, LTR],
      [10, 11, AUTO],
      [11, 14, AUTO],
    ]);
    expect(ranges(StructuredTextParser.STRUCTURED_TEXT_GDSCRIPT, "_id+'q'")).toEqual([
      [0, 3, AUTO],
      [3, 4, AUTO],
      [4, 5, LTR],
      [5, 6, AUTO],
      [6, 7, LTR],
    ]);
  });

  it('DEFAULT gives one INHERITED range over the whole text', () => {
    expect(ranges(StructuredTextParser.STRUCTURED_TEXT_DEFAULT, 'a/b')).toEqual([[0, 3, INHERITED]]);
  });

  it('CUSTOM gives no range, as only a script answers it', () => {
    expect(ranges(StructuredTextParser.STRUCTURED_TEXT_CUSTOM, 'a/b')).toEqual([]);
  });
});
