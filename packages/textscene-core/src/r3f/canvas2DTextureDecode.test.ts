/**
 * The 2D-canvas texture retag and its define. The retag is a pin because R3F's
 * `applyProps` rewrites a `map`-slot texture's `colorSpace` to `SRGBColorSpace`
 * on commit (`colorMaps.includes(key)`, `events-*.js`), so an R3F bump can break it.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { fakeTiledUploads } from './tiledUpload/fakeTiledUploads.testkit';
import * as THREE from 'three';
import { useCanvas2DTexture, useCanvasSrgbDefines } from './canvas2DTextureDecode';
import { markSrgbBytes } from './srgbByteTextures';

/** Linear and Disabled, the viewport defaults (`viewport.h:419-420`). */
const DEFAULT_SAMPLER = { filter: 2, repeat: 1 };

function makeTexture(colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace): THREE.Texture {
  const texture = new THREE.Texture();
  texture.colorSpace = colorSpace;
  return texture;
}

describe('useCanvas2DTexture', () => {
  it('returns null for a null/undefined input, allocating nothing', () => {
    const { result } = renderHook(({ tex }) => useCanvas2DTexture(tex, DEFAULT_SAMPLER), {
      initialProps: { tex: null as THREE.Texture | null },
    });
    expect(result.current).toBeNull();
  });

  it('clones the input and pins the clone to NoColorSpace, leaving the source untouched', () => {
    const source = makeTexture(THREE.SRGBColorSpace);
    const { result } = renderHook(({ tex }) => useCanvas2DTexture(tex, DEFAULT_SAMPLER), {
      initialProps: { tex: source as THREE.Texture | null },
    });
    expect(result.current).not.toBeNull();
    expect(result.current).not.toBe(source);
    expect(result.current?.colorSpace).toBe(THREE.NoColorSpace);
    expect(source.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('is immune to a downstream reassignment, e.g. from applyProps auto-tagging', () => {
    const source = makeTexture();
    const { result } = renderHook(({ tex }) => useCanvas2DTexture(tex, DEFAULT_SAMPLER), {
      initialProps: { tex: source as THREE.Texture | null },
    });
    const clone = result.current!;
    clone.colorSpace = THREE.SRGBColorSpace; // what applyProps would attempt
    expect(clone.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('re-clones when the source texture identity changes', () => {
    const first = makeTexture();
    const second = makeTexture();
    const { result, rerender } = renderHook(({ tex }) => useCanvas2DTexture(tex, DEFAULT_SAMPLER), {
      initialProps: { tex: first as THREE.Texture | null },
    });
    const firstClone = result.current;
    rerender({ tex: second });
    expect(result.current).not.toBe(firstClone);
  });
});

describe('useCanvas2DTexture sampler', () => {
  it("samples the clone with the item's filter and repeat, whatever the source was handed over with", () => {
    const NEAREST = 1;
    const REPEAT_MIRROR = 3;
    const source = makeTexture();
    source.wrapS = source.wrapT = THREE.RepeatWrapping;
    const { result } = renderHook(() =>
      useCanvas2DTexture(source, { filter: NEAREST, repeat: REPEAT_MIRROR })
    );
    const clone = result.current!;
    expect([clone.magFilter, clone.minFilter]).toEqual([THREE.NearestFilter, THREE.NearestFilter]);
    expect([clone.wrapS, clone.wrapT]).toEqual([THREE.MirroredRepeatWrapping, THREE.MirroredRepeatWrapping]);
    expect([source.magFilter, source.wrapS]).toEqual([THREE.LinearFilter, THREE.RepeatWrapping]);
  });
});

describe('useCanvas2DTexture in a canvas', () => {
  it('clamps the clone before its upload, and draws it unchanged once uploaded', async () => {
    const { pending, wrapper } = fakeTiledUploads();
    const source = makeTexture();
    source.name = 'large';
    source.wrapS = source.wrapT = THREE.RepeatWrapping;
    const { result } = renderHook(() => useCanvas2DTexture(source, DEFAULT_SAMPLER), { wrapper });

    const [upload] = pending;
    expect(upload?.texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(upload?.texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
    // A change after the upload would move three's cache key, or its version, and upload it whole.
    const versionAtUpload = upload?.texture.version;
    await act(async () => upload?.finish(true));

    expect(result.current).toBe(upload?.texture);
    expect(result.current?.version).toBe(versionAtUpload);
  });
});

describe('useCanvasSrgbDefines', () => {
  it('returns the sRGB-multiply define for a NoColorSpace texture', () => {
    const texture = makeTexture(THREE.NoColorSpace);
    const { result } = renderHook(() => useCanvasSrgbDefines(texture));
    expect(result.current).toEqual({ CANVAS_SRGB_MULTIPLY: '' });
  });

  it('returns undefined for an untouched (SRGBColorSpace) texture', () => {
    const texture = makeTexture(THREE.SRGBColorSpace);
    const { result } = renderHook(() => useCanvasSrgbDefines(texture));
    expect(result.current).toBeUndefined();
  });

  /**
   * A canvas target keeps the sRGB tag its pass encodes through, which R3F also stamps on a bound
   * `map`, so the mark, not the tag, says its bytes are sRGB numbers.
   */
  it('returns the sRGB-multiply define for a texture marked as holding sRGB bytes', () => {
    const texture = markSrgbBytes(makeTexture(THREE.SRGBColorSpace));
    const { result } = renderHook(() => useCanvasSrgbDefines(texture));
    expect(result.current).toEqual({ CANVAS_SRGB_MULTIPLY: '' });
  });

  it('returns undefined for null/undefined (no map bound yet)', () => {
    const { result } = renderHook(({ tex }) => useCanvasSrgbDefines(tex), {
      initialProps: { tex: null as THREE.Texture | null },
    });
    expect(result.current).toBeUndefined();
  });

  it('keeps a stable identity across rerenders with the same texture', () => {
    const texture = makeTexture(THREE.NoColorSpace);
    const { result, rerender } = renderHook(({ tex }) => useCanvasSrgbDefines(tex), {
      initialProps: { tex: texture as THREE.Texture | null },
    });
    const first = result.current;
    rerender({ tex: texture });
    expect(result.current).toBe(first);
  });
});
