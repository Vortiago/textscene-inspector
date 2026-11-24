import { deflateSync, gzipSync } from 'node:zlib';
import { inflateSync } from 'three/addons/libs/fflate.module.js';
import { describe, expect, it } from 'vitest';
import { inflateGzip, inflateZlib } from './zlibStream';

const TEXT = new TextEncoder().encode('hello hello hello hello world');
const inflate = (deflate: Uint8Array) => inflateSync(deflate);
const join = (...parts: ArrayLike<number>[]) => Uint8Array.from(parts.flatMap((part) => Array.from(part)));
const withByte = (bytes: Uint8Array, at: number, value: number) => {
  const copy = Uint8Array.from(bytes);
  copy[at] = value;
  return copy;
};

describe('inflateZlib', () => {
  const stream = deflateSync(TEXT);

  it('gives the bytes and the end of the Adler-32 trailer', () => {
    const result = inflateZlib(join(stream, [1, 2, 3]), inflate);
    expect(result?.output).toEqual(TEXT);
    expect(result?.end).toBe(stream.length);
  });

  it('refuses a header whose check bits are wrong (error case)', () => {
    expect(inflateZlib(withByte(stream, 1, stream[1]! + 1), inflate)).toBeUndefined();
  });

  it('refuses a preset dictionary (error case)', () => {
    expect(inflateZlib(join([0x78, 0xbb], stream.subarray(2)), inflate)).toBeUndefined();
  });

  it('refuses a wrong Adler-32 (error case)', () => {
    expect(inflateZlib(withByte(stream, stream.length - 1, stream.at(-1)! ^ 1), inflate)).toBeUndefined();
  });

  it('refuses a stream cut before its trailer (error case)', () => {
    expect(inflateZlib(stream.subarray(0, stream.length - 2), inflate)).toBeUndefined();
  });
});

describe('inflateGzip', () => {
  const member = gzipSync(TEXT);

  it('reads the first member and ends after its length field', () => {
    const result = inflateGzip(join(member, member), inflate);
    expect(result?.output).toEqual(TEXT);
    expect(result?.end).toBe(member.length);
  });

  it('skips a file name in the header', () => {
    const named = join(member.subarray(0, 3), [0x08], member.subarray(4, 10), [0x61, 0], member.subarray(10));
    expect(inflateGzip(named, inflate)?.output).toEqual(TEXT);
  });

  it('refuses a reserved flag (error case)', () => {
    expect(inflateGzip(withByte(member, 3, 0x20), inflate)).toBeUndefined();
  });

  it('refuses a wrong CRC-32 (error case)', () => {
    expect(inflateGzip(withByte(member, member.length - 8, member.at(-8)! ^ 1), inflate)).toBeUndefined();
  });

  it('refuses a wrong length (error case)', () => {
    expect(inflateGzip(withByte(member, member.length - 4, member.at(-4)! ^ 1), inflate)).toBeUndefined();
  });
});
