import { describe, expect, it } from 'vitest';
import { codesOf } from './codes';
import { REPLACEMENT, utf16Bytes, utf8Bytes, utf8Codes } from './encodings';

describe('utf8Bytes', () => {
  it('matches the platform encoder on well-formed text', () => {
    const text = 'aé€😀߿￿';
    expect(utf8Bytes(codesOf(text))).toEqual(Array.from(new TextEncoder().encode(text)));
  });

  it('keeps the three bytes of a lone surrogate', () => {
    expect(utf8Bytes([0xd800])).toEqual([0xed, 0xa0, 0x80]);
  });
});

describe('utf16Bytes', () => {
  it('writes a code past the plane as a little-endian surrogate pair', () => {
    expect(utf16Bytes([0x1f600])).toEqual([0x3d, 0xd8, 0x00, 0xde]);
  });
});

describe('utf8Codes', () => {
  it('skips a leading byte order mark and stops at NUL', () => {
    expect(utf8Codes([0xef, 0xbb, 0xbf, 0x61, 0x00, 0x62])).toEqual([0x61]);
  });

  it('replaces a truncated three-byte sequence that is well formed so far with one U+FFFD', () => {
    expect(utf8Codes([0xe2, 0x82, 0x41])).toEqual([REPLACEMENT, 0x41]);
  });

  it('replaces each byte of an overlong or out-of-range sequence on its own', () => {
    expect(utf8Codes([0xc0, 0xaf])).toEqual([REPLACEMENT, REPLACEMENT]);
    expect(utf8Codes([0xf5, 0x80, 0x80, 0x80])).toEqual([REPLACEMENT, REPLACEMENT, REPLACEMENT, REPLACEMENT]);
  });

  it('replaces the first three bytes of a four-byte sequence that breaks at its last byte', () => {
    expect(utf8Codes([0xf0, 0x9f, 0x98, 0x41])).toEqual([REPLACEMENT, 0x41]);
  });
});
