import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { transpileSky } from '../shaders/sky/transpileSky';
import { mayDecompress, useShaderDecoders } from './shaderDecoders';

/** "hello hello hello hello world" in Zstandard (mode 2) and in Brotli (mode 4), as Godot writes them. */
const ZSTD =
  '[40, 181, 47, 253, 32, 29, 141, 0, 0, 88, 104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100, 1, 0, 241, 74, 17]';
const BROTLI =
  '[27, 28, 0, 248, 141, 148, 110, 222, 68, 85, 134, 150, 108, 32, 111, 53, 200, 60, 117, 192, 10, 17, 71]';

const skyDecoding = (bytes: string, mode: number) =>
  `shader_type sky;\n#if PackedByteArray(${bytes}).decompress(29, ${mode}).get_string_from_ascii() == "hello hello hello hello world"\nvoid sky() { COLOR = vec3(1.0); }\n#endif\n`;

/** The decoders the previewer lends a text that names decompress, once they load. */
async function lentDecoders(code: string) {
  const { result } = renderHook(() => useShaderDecoders(code));
  await waitFor(() => expect(result.current).not.toBeNull());
  return result.current!;
}

describe('useShaderDecoders', () => {
  it('lends a sky shader the Zstandard decoder', async () => {
    const code = skyDecoding(ZSTD, 2);
    const decoders = await lentDecoders(code);
    expect(() => transpileSky(code, { decoders })).not.toThrow();
  });

  it('lends a sky shader the Brotli decoder', async () => {
    const code = skyDecoding(BROTLI, 4);
    const decoders = await lentDecoders(code);
    expect(() => transpileSky(code, { decoders })).not.toThrow();
  });
});

describe('mayDecompress', () => {
  it('waits for the decoders for a text that names decompress', () => {
    expect(mayDecompress(skyDecoding(ZSTD, 2))).toBe(true);
  });

  it('waits for nothing for a text that never names it', () => {
    expect(mayDecompress('shader_type sky;\nvoid sky() {}\n')).toBe(false);
  });
});
