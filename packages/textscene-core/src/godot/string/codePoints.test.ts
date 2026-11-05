import { describe, expect, it } from 'vitest';
import { codePointCount, codePointIndexAt, sliceCodePoints, utf16OffsetOf } from './codePoints.js';

const GRIN = '😀';

describe('codePoints (a Godot String holds code points, a JS string UTF-16 units)', () => {
  it('counts an astral character once', () => {
    expect(codePointCount(`${GRIN}${GRIN}abc`)).toBe(5);
    expect(codePointCount('')).toBe(0);
  });

  it('counts a lone surrogate once', () => {
    expect(codePointCount('\uD83Dx')).toBe(2);
  });

  it('slices by code points, never inside a pair', () => {
    expect(sliceCodePoints(`${GRIN}${GRIN}abc`, 3)).toBe(`${GRIN}${GRIN}a`);
    expect(sliceCodePoints('abc', 9)).toBe('abc');
    expect(sliceCodePoints('abc', 0)).toBe('');
  });

  it('maps a code point index to the UTF-16 offset where it starts', () => {
    expect(utf16OffsetOf(`${GRIN}ab`, 0)).toBe(0);
    expect(utf16OffsetOf(`${GRIN}ab`, 1)).toBe(2);
    expect(utf16OffsetOf(`${GRIN}ab`, 9)).toBe(4);
  });

  it('maps a UTF-16 offset to the code point index it falls in', () => {
    expect(codePointIndexAt(`${GRIN}ab`, 2)).toBe(1);
    expect(codePointIndexAt(`${GRIN}ab`, 3)).toBe(2);
    expect(codePointIndexAt(`${GRIN}ab`, 9)).toBe(3);
  });
});
