import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { decompress as zstd } from 'fzstd';
import * as transpiler from '../../resources/sky/shaderSky';
import { decodeSky, decodeSkyMaterial } from '../../resources/sky/decode';
import type { AuthoredSky } from '../../resources/sky/types';
import { useReadSky } from './readSky';

/** "hello hello hello hello world" in Zstandard, as Godot writes it. */
const ZSTD =
  '[40, 181, 47, 253, 32, 29, 141, 0, 0, 88, 104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100, 1, 0, 241, 74, 17]';

/** A sky whose sampler sits behind an `#if` that decompresses. */
const CODE = `shader_type sky;\n#if PackedByteArray(${ZSTD}).decompress(29, 2).get_string_from_ascii() == "hello hello hello hello world"\nuniform samplerCube faces;\n#endif\nvoid sky() {}\n`;

function shaderSky(code: string): AuthoredSky {
  return decodeSky({}, { kind: 'shader', code, file: 'res://sky.gdshader', parameters: {}, textures: {} });
}

describe('useReadSky', () => {
  it('reads the samplers behind a decompressing `#if` with the decoders', () => {
    const { result } = renderHook(() => useReadSky(shaderSky(CODE), transpiler, { zstd }));
    const material = result.current?.material;
    expect(material?.kind === 'shader' && material.usage.samplers).toEqual({
      faces: { kind: 'cube', isColor: false },
    });
  });

  it('gives one read sky to each viewport that draws the sky, so they share its bake', () => {
    const sky = shaderSky(CODE);
    const decoders = { zstd };
    const first = renderHook(() => useReadSky(sky, transpiler, decoders)).result.current;
    expect(renderHook(() => useReadSky(sky, transpiler, decoders)).result.current).toBe(first);
  });

  it('gives no sky while the decoders load', () => {
    expect(renderHook(() => useReadSky(shaderSky(CODE), transpiler, null)).result.current).toBeNull();
  });

  it('gives no sky while the transpiler loads', () => {
    expect(renderHook(() => useReadSky(shaderSky(CODE), null, { zstd })).result.current).toBeNull();
  });

  it('keeps a built-in sky, which needs no transpiler (edge case)', () => {
    const sky = decodeSky({}, decodeSkyMaterial('ProceduralSkyMaterial', {})!);
    expect(renderHook(() => useReadSky(sky, null, null)).result.current).toBe(sky);
  });
});
