import { describe, expect, it } from 'vitest';
import { stringFormat } from './stringFormat.js';
import { variant } from './value/variant.js';

const int = (value: bigint) => variant('INT', value);

// Each expected text is Godot 4.6.3's, and each error the text of String::sprintf (ustring.cpp:5222).
describe('stringFormat', () => {
  it('fills the integer, float, string, hex, char and left-aligned placeholders', () => {
    const values = [
      int(42n),
      variant('FLOAT', 3.14159),
      variant('VECTOR2', { x: 1, y: 2 }),
      int(255n),
      int(65n),
      int(7n),
    ];
    expect(stringFormat('%d|%5.2f|%s|%x|%c|%-4d|', values)).toEqual({
      text: '42| 3.14|(1.0, 2.0)|ff|A|7   |',
      isError: false,
    });
  });

  it('writes a vector with %v', () => {
    expect(stringFormat('%v', [variant('VECTOR2', { x: 1.5, y: 2 })]).text).toBe('(1.500000, 2.000000)');
  });

  it('fails %d of a string', () => {
    expect(stringFormat('%d', [variant('STRING', 'a')])).toEqual({
      text: 'a number is required',
      isError: true,
    });
  });

  it('fails a format with too few values', () => {
    expect(stringFormat('%d %d', [int(1n)])).toEqual({
      text: 'not enough arguments for format string',
      isError: true,
    });
  });
});
