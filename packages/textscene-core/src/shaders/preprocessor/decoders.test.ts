import { decompress as zstdDecompress } from 'fzstd';
import { describe, expect, it } from 'vitest';
import { UnportedMethod } from '../../godot/variant/call/unportedMethod';
import { decodersOf } from './decoders';

/** "hello hello hello hello world" as Godot's `compress(2)` writes it. */
const GODOT_ZSTD = Uint8Array.from([
  40, 181, 47, 253, 32, 29, 141, 0, 0, 88, 104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100, 1, 0, 241,
  74, 17,
]);

describe('decodersOf', () => {
  it('decodes Zstandard with the fzstd an app lends', () => {
    expect(new TextDecoder().decode(decodersOf({ zstd: zstdDecompress }).zstd(GODOT_ZSTD))).toBe(
      'hello hello hello hello world'
    );
  });

  it('names the package to install for a Zstandard decoder no app lent (error case)', () => {
    expect(() => decodersOf().zstd(GODOT_ZSTD)).toThrow(UnportedMethod);
    expect(() => decodersOf().zstd(GODOT_ZSTD)).toThrow(/install it, `import \{ decompress \} from 'fzstd'`/);
  });

  it('names the package to install for a Brotli decoder no app lent (error case)', () => {
    expect(() => decodersOf().brotli(Uint8Array.from([1]))).toThrow(/brotli\/decompress/);
  });
});
