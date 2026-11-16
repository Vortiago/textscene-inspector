import { describe, expect, it } from 'vitest';
import { UnportableUtility } from '../../variant/utility/unportableUtility';
import { fastLzDecompress } from './fastlz';

const ascii = (value: string) => [...value].map((char) => char.charCodeAt(0));
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

/** "hello hello hello hello world" as Godot's `compress(0)` writes it. */
const GODOT_LEVEL_1 = Uint8Array.from([
  5, 104, 101, 108, 108, 111, 32, 224, 9, 5, 4, 119, 111, 114, 108, 100,
]);

describe('fastLzDecompress', () => {
  it('decodes a level 1 stream Godot wrote', () => {
    const { written, isComplete } = fastLzDecompress(GODOT_LEVEL_1, 64);
    expect(text(written)).toBe('hello hello hello hello world');
    expect(isComplete).toBe(true);
  });

  it('repeats an earlier run that overlaps the bytes it writes', () => {
    expect(text(fastLzDecompress(Uint8Array.from([0x02, ...ascii('abc'), 0x80, 0x02]), 9).written)).toBe(
      'abcabcabc'
    );
  });

  it('reads a level 2 length that runs over several 255 bytes', () => {
    const stream = Uint8Array.from([0x20, ...ascii('a'), 0xe0, 0xff, 0x01, 0x00]);
    expect(fastLzDecompress(stream, 300).written).toEqual(new Uint8Array(266).fill(0x61));
  });

  it('stops where the output would pass its bound, keeping what it wrote (edge case)', () => {
    const { written, isComplete } = fastLzDecompress(GODOT_LEVEL_1, 10);
    expect(text(written)).toBe('hello ');
    expect(isComplete).toBe(false);
  });

  it('stops on a match before the start of the output (error case)', () => {
    expect(fastLzDecompress(Uint8Array.from([0x00, ...ascii('a'), 0x40, 0x05]), 16).isComplete).toBe(false);
  });

  it('writes nothing for a level past 2 (error case)', () => {
    expect(fastLzDecompress(Uint8Array.from([0x42, ...ascii('abc')]), 16)).toEqual({
      written: new Uint8Array(0),
      isComplete: false,
    });
  });

  it('refuses a level 2 stream whose match reads past its end, as Godot reads the heap there (error case)', () => {
    expect(() => fastLzDecompress(Uint8Array.from([0x20, ...ascii('a'), 0x40]), 16)).toThrow(
      new UnportableUtility('decompress of a FastLZ stream that reads past its end')
    );
  });
});
