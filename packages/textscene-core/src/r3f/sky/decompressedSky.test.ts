import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { decompress as zstd } from 'fzstd';
import type { Sky } from '../../resources/sky/types';
import { skyUsage } from '../../shaders/sky/skyUsage';
import { useDecompressedSky } from './decompressedSky';

/** "hello hello hello hello world" in Zstandard, as Godot writes it. */
const ZSTD =
  '[40, 181, 47, 253, 32, 29, 141, 0, 0, 88, 104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100, 1, 0, 241, 74, 17]';

/** A sky whose sampler sits behind an `#if` that decompresses. */
const CODE = `shader_type sky;\n#if PackedByteArray(${ZSTD}).decompress(29, 2).get_string_from_ascii() == "hello hello hello hello world"\nuniform samplerCube faces;\n#endif\nvoid sky() {}\n`;

function skyOf(code: string): Sky {
  return {
    material: { kind: 'shader', code, parameters: {}, textures: {}, usage: skyUsage(code) },
    processMode: 0,
    radianceSize: 256,
  } as unknown as Sky;
}

describe('useDecompressedSky', () => {
  it('reads the samplers behind a decompressing `#if` once the decoders load', () => {
    const { result } = renderHook(() => useDecompressedSky(skyOf(CODE), { zstd }));
    const { material } = result.current;
    expect(material.kind === 'shader' && material.usage.samplers).toEqual({
      faces: { kind: 'cube', isColor: false },
    });
  });

  it('keeps the sky while the decoders load', () => {
    const sky = skyOf(CODE);
    expect(renderHook(() => useDecompressedSky(sky, null)).result.current).toBe(sky);
  });

  it('keeps a sky whose text never decompresses (edge case)', () => {
    const sky = skyOf('shader_type sky;\nvoid sky() {}\n');
    expect(renderHook(() => useDecompressedSky(sky, { zstd })).result.current).toBe(sky);
  });
});
