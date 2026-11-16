import { crc32 as nodeCrc32, deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { adler32, crc32 } from './checksums';

const bytes = (text: string) => new TextEncoder().encode(text);
function zlibAdler(input: Uint8Array): number {
  const stream = deflateSync(input);
  return stream.readUInt32BE(stream.length - 4);
}

describe('adler32', () => {
  it('starts at 1 for no bytes', () => {
    expect(adler32(new Uint8Array(0))).toBe(1);
  });

  it('matches the trailer zlib writes after "Wikipedia"', () => {
    expect(adler32(bytes('Wikipedia'))).toBe(0x11e60398);
  });

  it('keeps both sums below 65521 on a long input', () => {
    const input = new Uint8Array(100_000).fill(255);
    expect(adler32(input)).toBe(zlibAdler(input));
  });
});

describe('crc32', () => {
  it('matches zlib on a text', () => {
    const text = bytes('hello hello hello hello world');
    expect(crc32(text)).toBe(nodeCrc32(text));
  });

  it('gives 0 for no bytes', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});
