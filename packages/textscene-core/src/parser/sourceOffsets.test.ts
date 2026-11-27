import { describe, expect, it } from 'vitest';
import {
  escapedNewlinesIn,
  escapesItsNewline,
  headingText,
  lineAndColumnOf,
  lineStartsOf,
  opensKey,
  valueOffset,
  withoutComments,
} from './sourceOffsets';

describe('lineStartsOf', () => {
  it('gives the offset after each newline', () => {
    expect(lineStartsOf('ab\ncd\ne')).toEqual([0, 3, 6]);
  });

  it('gives one line to empty text', () => {
    expect(lineStartsOf('')).toEqual([0]);
  });

  it('counts a line after a final newline, and keeps a `\\r` in the line before it', () => {
    expect(lineStartsOf('a\r\n')).toEqual([0, 3]);
  });
});

describe('lineAndColumnOf', () => {
  const starts = lineStartsOf('ab\ncd\ne');

  it('finds the line and column of an offset', () => {
    expect(lineAndColumnOf(starts, 4, 0)).toEqual({ line: 1, column: 1 });
  });

  it('gives a column past the last line start to an offset past the end', () => {
    expect(lineAndColumnOf(starts, 9, 0)).toEqual({ line: 2, column: 3 });
  });

  it('puts a line start on its own line, not the line before', () => {
    expect(lineAndColumnOf(starts, 3, 0)).toEqual({ line: 1, column: 0 });
  });
});

describe('escapesItsNewline', () => {
  it('is true for a line that ends on one backslash', () => {
    const content = '"a\\\nb"';
    expect(escapesItsNewline(content, lineStartsOf(content), 0)).toBe(true);
  });

  it('is false for the last line, which has no newline', () => {
    const content = 'a\\';
    expect(escapesItsNewline(content, lineStartsOf(content), 0)).toBe(false);
  });

  it('is false for an even run of backslashes, or a `\\r` after the backslash', () => {
    const even = '"a\\\\\nb"';
    const crlf = '"a\\\r\nb"';
    expect([even, crlf].map((text) => escapesItsNewline(text, lineStartsOf(text), 0))).toEqual([
      false,
      false,
    ]);
  });
});

describe('escapedNewlinesIn', () => {
  it('gives the offset of each newline a backslash escapes', () => {
    expect(escapedNewlinesIn('a\\\nb\nc\\\nd')).toEqual([2, 7]);
  });

  it('gives nothing for text with no newline', () => {
    expect(escapedNewlinesIn('a\\')).toEqual([]);
  });

  it('skips a newline after an even run of backslashes', () => {
    expect(escapedNewlinesIn('a\\\\\nb')).toEqual([]);
  });
});

describe('withoutComments', () => {
  it('drops a `;` comment from each line', () => {
    expect(withoutComments('x="a" ; one\ny=1 ; two')).toBe('x="a" \ny=1 ');
  });

  it('keeps text with no `;` as it is', () => {
    expect(withoutComments('x="a"\ny=1')).toBe('x="a"\ny=1');
  });

  it('keeps a `;` inside a string that runs over a newline', () => {
    expect(withoutComments('x="a\n;b" ; c')).toBe('x="a\n;b" ');
  });
});

describe('opensKey', () => {
  it('is true for a bare key and its `=`', () => {
    expect(opensKey('  position = Vector2(1, 2)')).toBe(true);
  });

  it('is false for a string that holds an `=`', () => {
    expect(opensKey('"x=y"')).toBe(false);
  });

  it('is false for a line with no `=`, or one that starts with it', () => {
    expect([opensKey('position'), opensKey('= 1')]).toEqual([false, false]);
  });
});

describe('valueOffset', () => {
  it('gives the column past the `=` and its white space', () => {
    expect(valueOffset('position = Vector2(1, 2)')).toBe(11);
  });

  it('gives the column past the `=` for a line that ends there', () => {
    expect(valueOffset('texture =')).toBe(9);
  });

  it('skips a control code Godot skips after the `=`', () => {
    expect(valueOffset('visible=\x01true')).toBe(9);
  });
});

describe('headingText', () => {
  it('cuts a heading on one line from its column to its `]`', () => {
    const lines = ['x = 1 [node name="A"] y = 2'];
    expect(headingText(lines, 0, 6, { line: 0, column: 21 })).toBe('[node name="A"]');
  });

  it('joins a heading over several lines and drops its comments', () => {
    const lines = ['[node name="A" ; a comment', 'type="Node"] x = 1'];
    expect(headingText(lines, 0, 0, { line: 1, column: 12 })).toBe('[node name="A" \ntype="Node"]');
  });

  it('keeps a `;` inside a string of a heading over several lines', () => {
    const lines = ['[node name="A', ';B"]'];
    expect(headingText(lines, 0, 0, { line: 1, column: 4 })).toBe('[node name="A\n;B"]');
  });
});
