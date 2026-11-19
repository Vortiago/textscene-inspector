import { describe, expect, it } from 'vitest';
import { crc32 } from './crc32';

const bytesOf = (text: string) => new TextEncoder().encode(text);

describe('crc32', () => {
  it('gives the check value of the PNG specification for "123456789"', () => {
    expect(crc32(bytesOf('123456789'))).toBe(0xcbf43926);
  });

  it('gives 0 for no bytes', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('gives the CRC of a PNG IEND chunk type', () => {
    expect(crc32(bytesOf('IEND'))).toBe(0xae426082);
  });
});
