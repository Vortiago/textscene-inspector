import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { CompressionMode } from '../../project/compressedFile';
import { UnrepresentableArray } from '../../variant/call/arrayLength';
import { UnportedMethod } from '../../variant/call/unportedMethod';
import { UnportableUtility } from '../../variant/utility/unportableUtility';
import { decompress, decompressDynamic, type Decoders } from './compression';
import { decompress as brotliDecompress } from 'brotli/decompress';
import { decompress as zstdDecompress } from 'fzstd';
import { decodersOf } from '../../../shaders/preprocessor/decoders';

const DECODERS = decodersOf({ zstd: zstdDecompress, brotli: brotliDecompress });
const TEXT = new TextEncoder().encode('hello hello hello hello world');
const FASTLZ = Uint8Array.from([5, 104, 101, 108, 108, 111, 32, 224, 9, 5, 4, 119, 111, 114, 108, 100]);
const join = (...parts: ArrayLike<number>[]) => Uint8Array.from(parts.flatMap((part) => Array.from(part)));

describe('decompress', () => {
  it('gives empty for a buffer size of 0 or a mode past Brotli', () => {
    expect(decompress(FASTLZ, 0n, CompressionMode.FastLz)).toEqual(new Uint8Array(0));
    expect(decompress(FASTLZ, 64n, 9)).toEqual(new Uint8Array(0));
  });

  it('decodes FastLZ with no decoders lent', () => {
    expect(decompress(FASTLZ, 29n, CompressionMode.FastLz)).toEqual(TEXT);
  });

  it('keeps the first bytes of a FastLZ buffer under 16 (edge case)', () => {
    expect(decompress(FASTLZ, 5n, CompressionMode.FastLz)).toEqual(TEXT.subarray(0, 5));
  });

  it('refuses a FastLZ buffer under 16 that FastLZ wrote less of, as Godot copies unset memory (error case)', () => {
    expect(() => decompress(Uint8Array.from([0x02, 1, 2, 3]), 8n, CompressionMode.FastLz)).toThrow(
      new UnportableUtility('decompress of a FastLZ stream shorter than its buffer, which reads unset memory')
    );
  });

  it('lends the decoder a buffer one byte past the buffer size, so a stream inflating far past it stops there', () => {
    const outLengths: number[] = [];
    const inflate: Decoders['inflate'] = (deflate, out) => {
      outLengths.push(out?.length ?? Infinity);
      return DECODERS.inflate(deflate, out);
    };
    const zeros = deflateSync(new Uint8Array(1_000_000));
    expect(decompress(zeros, 10n, CompressionMode.Deflate, { ...DECODERS, inflate })).toEqual(
      new Uint8Array(0)
    );
    expect(Math.max(...outLengths)).toBe(11);
  });

  it('gives empty for a stored block past the buffer size (edge case)', () => {
    expect(decompress(deflateSync(TEXT, { level: 0 }), 5n, CompressionMode.Deflate, DECODERS)).toEqual(
      new Uint8Array(0)
    );
    expect(decompress(gzipSync(TEXT, { level: 0 }), 29n, CompressionMode.Gzip, DECODERS)).toEqual(TEXT);
  });

  it('decodes Deflate and GZIP that fit the buffer, and gives empty for one that does not', () => {
    expect(decompress(deflateSync(TEXT), 29n, CompressionMode.Deflate, DECODERS)).toEqual(TEXT);
    expect(decompress(gzipSync(TEXT), 29n, CompressionMode.Gzip, DECODERS)).toEqual(TEXT);
    expect(decompress(deflateSync(TEXT), 28n, CompressionMode.Deflate, DECODERS)).toEqual(new Uint8Array(0));
  });

  it('gives empty for a Zstandard stream its decoder refuses', () => {
    const refusing: Decoders = {
      ...DECODERS,
      zstd: () => {
        throw new Error('bad frame');
      },
    };
    expect(decompress(Uint8Array.from([1, 2]), 8n, CompressionMode.Zstd, refusing)).toEqual(
      new Uint8Array(0)
    );
  });

  it('refuses a Zstandard or Brotli buffer longer than V8 holds, as Godot allocates it first (error case)', () => {
    expect(() => decompress(brotliCompressSync(TEXT), 2n ** 62n, CompressionMode.Brotli, DECODERS)).toThrow(
      UnrepresentableArray
    );
  });

  it('refuses Deflate with no decoders lent (error case)', () => {
    expect(() => decompress(deflateSync(TEXT), 29n, CompressionMode.Deflate)).toThrow(UnportedMethod);
  });

  it('decodes Brotli that fits the buffer, and gives empty for a stream cut short', () => {
    expect(decompress(brotliCompressSync(TEXT), 29n, CompressionMode.Brotli, DECODERS)).toEqual(TEXT);
    expect(
      decompress(brotliCompressSync(TEXT).subarray(0, 10), 29n, CompressionMode.Brotli, DECODERS)
    ).toEqual(new Uint8Array(0));
  });
});

describe('decompressDynamic', () => {
  it('has no limit for a negative maximum, and gives empty past a maximum', () => {
    expect(decompressDynamic(deflateSync(TEXT), -1n, CompressionMode.Deflate, DECODERS)).toEqual(TEXT);
    expect(decompressDynamic(deflateSync(TEXT), 28n, CompressionMode.Deflate, DECODERS)).toEqual(
      new Uint8Array(0)
    );
  });

  it('gives empty for FastLZ, which it does not read', () => {
    expect(decompressDynamic(FASTLZ, -1n, CompressionMode.FastLz, DECODERS)).toEqual(new Uint8Array(0));
  });

  it('refuses a Brotli stream cut short, where Godot asks for more input for ever (error case)', () => {
    expect(() =>
      decompressDynamic(brotliCompressSync(TEXT).subarray(0, 10), -1n, CompressionMode.Brotli, DECODERS)
    ).toThrow(
      new UnportableUtility(
        'decompress_dynamic of a Brotli stream that ends early, where Godot never returns'
      )
    );
  });

  // Godot 4.6.3 gives 16384 and 32768 bytes for these two, and an empty array past a maximum of 100.
  it('returns bytes after a stream that fills its last chunk exactly, as Godot does', () => {
    const chunks = (count: number) => Uint8Array.from({ length: 16384 * count }, (_, i) => (i * 7) % 251);
    for (const count of [1, 2])
      expect(
        decompressDynamic(join(deflateSync(chunks(count)), [1, 2, 3]), -1n, CompressionMode.Deflate, DECODERS)
      ).toEqual(chunks(count));
  });

  it('gives empty for bytes after a stream whose full chunk passes the maximum, as Godot does', () => {
    const output = Uint8Array.from({ length: 40000 }, (_, i) => (i * 7) % 251);
    expect(
      decompressDynamic(join(deflateSync(output), [1, 2, 3]), 100n, CompressionMode.Deflate, DECODERS)
    ).toEqual(new Uint8Array(0));
  });

  it('refuses bytes after the stream, where Godot loops on Z_STREAM_END (error case)', () => {
    expect(() =>
      decompressDynamic(join(deflateSync(TEXT), [1, 2, 3]), -1n, CompressionMode.Deflate, DECODERS)
    ).toThrow(
      new UnportableUtility(
        'decompress_dynamic of a stream with bytes after its end, where Godot never returns'
      )
    );
  });
});
