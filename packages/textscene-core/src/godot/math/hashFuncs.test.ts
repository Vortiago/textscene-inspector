import { describe, expect, it } from 'vitest';
import { murmur3Buffer, murmur3OneDouble, murmur3OneFloat, stringHash } from './hashFuncs';

describe('murmur3OneFloat', () => {
  it('hashes both zeros alike', () => {
    expect(murmur3OneFloat(-0)).toBe(murmur3OneFloat(0));
  });

  it('hashes every NaN alike', () => {
    const signedNan = new Float64Array(new BigUint64Array([0xfff8000000000001n]).buffer)[0]!;
    expect(murmur3OneFloat(signedNan)).toBe(murmur3OneFloat(Number.NaN));
  });
});

describe('murmur3OneDouble', () => {
  it('hashes both zeros alike', () => {
    expect(murmur3OneDouble(-0)).toBe(murmur3OneDouble(0));
  });
});

describe('murmur3Buffer', () => {
  it('folds a tail of one to three bytes after the blocks', () => {
    const lengths = [4, 5, 6, 7].map((length) => murmur3Buffer(Uint8Array.from({ length }, (_, i) => i + 1)));
    expect(new Set(lengths).size).toBe(4);
  });
});

describe('stringHash', () => {
  it('stops at the first NUL', () => {
    expect(stringHash('ab\0c')).toBe(stringHash('ab'));
  });

  it('is 5381 for the empty text', () => {
    expect(stringHash('')).toBe(5381);
  });
});
