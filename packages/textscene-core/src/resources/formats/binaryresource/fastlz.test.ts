/**
 * The FastLZ level 1 decoder, on streams laid out as `fastlz1_compress` writes them. The RSCC
 * fixtures in `compressed.test.ts` cover a stream Godot itself wrote.
 */

import { describe, expect, it } from 'vitest';
import { decompressFastLz } from './fastlz';

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const ascii = (value: string) => [...value].map((char) => char.charCodeAt(0));

describe('decompressFastLz', () => {
  it('copies a literal run', () => {
    expect(text(decompressFastLz(new Uint8Array([0x02, ...ascii('abc')]), 3))).toBe('abc');
  });

  it('repeats an earlier run that overlaps the bytes it writes', () => {
    // A match of 6 bytes from 3 back: (0x80 >> 5) - 1 + 3 = 6, distance 0x02 + 1 = 3.
    const stream = new Uint8Array([0x02, ...ascii('abc'), 0x80, 0x02]);
    expect(text(decompressFastLz(stream, 9))).toBe('abcabcabc');
  });

  it('reads the extra length byte of a long match', () => {
    // (0xe0 >> 5) - 1 = 6 takes the next byte as more length: 6 + 1 + 3 = 10.
    const stream = new Uint8Array([0x00, ...ascii('a'), 0xe0, 0x01, 0x00]);
    expect(text(decompressFastLz(stream, 11))).toBe('a'.repeat(11));
  });

  it('keeps the bytes a short block asks for from the 16 Godot pads it to (edge case)', () => {
    const stream = new Uint8Array([0x0f, ...ascii('abcdefghijklmnop')]);
    expect(text(decompressFastLz(stream, 3))).toBe('abc');
  });

  it('refuses a level 2 stream, which Godot writes for no 4096-byte block (error case)', () => {
    expect(() => decompressFastLz(new Uint8Array([0x22, ...ascii('abc')]), 3)).toThrow(
      'expected a FastLZ level 1 stream, got level 2'
    );
  });

  it('refuses a stream that ends short of the block, naming both sizes (error case)', () => {
    expect(() => decompressFastLz(new Uint8Array([0x02, ...ascii('abc')]), 10)).toThrow(
      'expected 10 bytes from a FastLZ stream, got 3'
    );
  });

  it('refuses a match that reaches before the start of the block (error case)', () => {
    expect(() => decompressFastLz(new Uint8Array([0x00, ...ascii('a'), 0x40, 0x05]), 4)).toThrow(
      'expected a FastLZ match within the 1 bytes written, got one 6 back'
    );
  });
});
