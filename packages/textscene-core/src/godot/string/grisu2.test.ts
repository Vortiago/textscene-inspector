import { describe, expect, it } from 'vitest';
import { doubleChars, floatChars } from './grisu2';

describe('doubleChars', () => {
  it.each([
    [0.1, '0.1'],
    [1e15, '1e+15'],
    [123456789012345.6, '123456789012345.6'],
    [0.0001, '0.0001'],
    [0.00001, '1e-05'],
    [1.7976931348623157e308, '1.7976931348623157e+308'],
    [-0, '-0'],
  ])('spells %d as %s', (value, text) => {
    expect(doubleChars(value)).toBe(text);
  });

  it('keeps the digits grisu2 finds where they are longer than the shortest', () => {
    expect(doubleChars(66246251121954220)).toBe('6.6246251121954224e+16');
    expect(String(66246251121954220)).toBe('66246251121954220');
  });

  it('reads back as the same double', () => {
    const values = Array.from({ length: 2000 }, (_, i) => Math.sin(i + 1) * 10 ** ((i % 600) - 300));
    expect(values.filter((value) => Number(doubleChars(value)) !== value)).toEqual([]);
  });
});

describe('floatChars', () => {
  it('spells a float with the digits that read back as that float', () => {
    expect(floatChars(Math.fround(0.1))).toBe('0.1');
    expect(floatChars(Math.fround(1e-45))).toBe('1e-45');
  });
});
