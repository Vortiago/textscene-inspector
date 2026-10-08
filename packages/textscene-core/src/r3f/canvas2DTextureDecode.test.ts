/**
 * The 2D-canvas texture retag and its define. `pinNoColorSpace` exists because
 * R3F's `applyProps` rewrites a `map`-slot texture's `colorSpace` to `SRGBColorSpace`
 * on commit (`colorMaps.includes(key)`, `events-*.js`), so an R3F bump can break it.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { fakeTiledUploads } from './tiledUpload/fakeTiledUploads.testkit';
import * as THREE from 'three';
import { pinNoColorSpace, useCanvas2DTexture, useCanvasDecodeDefines } from './canvas2DTextureDecode';

function makeTexture(colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace): THREE.Texture {
  const texture = new THREE.Texture();
  texture.colorSpace = colorSpace;
  return texture;
}

describe('pinNoColorSpace', () => {
  it('reads back NoColorSpace', () => {
    const texture = makeTexture(THREE.SRGBColorSpace);
    pinNoColorSpace(texture);
    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('discards a later reassignment attempt without throwing (strict-mode safe)', () => {
    const texture = makeTexture();
    pinNoColorSpace(texture);
    expect(() => {
      // The exact mutation `@react-three/fiber`'s `applyProps` performs on a
      // texture assigned to a `map` JSX prop.
      texture.colorSpace = THREE.SRGBColorSpace;
    }).not.toThrow();
    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
  });
});

describe('useCanvas2DTexture', () => {
  it('returns null for a null/undefined input, allocating nothing', () => {
    const { result } = renderHook(({ tex }) => useCanvas2DTexture(tex), {
      initialProps: { tex: null as THREE.Texture | null },
    });
    expect(result.current).toBeNull();
  });

  it('clones the input and pins the clone to NoColorSpace, leaving the source untouched', () => {
    const source = makeTexture(THREE.SRGBColorSpace);
    const { result } = renderHook(({ tex }) => useCanvas2DTexture(tex), {
      initialProps: { tex: source as THREE.Texture | null },
    });
    expect(result.current).not.toBeNull();
    expect(result.current).not.toBe(source);
    expect(result.current?.colorSpace).toBe(THREE.NoColorSpace);
    expect(source.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('is immune to a downstream reassignment, e.g. from applyProps auto-tagging', () => {
    const source = makeTexture();
    const { result } = renderHook(({ tex }) => useCanvas2DTexture(tex), {
      initialProps: { tex: source as THREE.Texture | null },
    });
    const clone = result.current!;
    clone.colorSpace = THREE.SRGBColorSpace; // what applyProps would attempt
    expect(clone.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('re-clones when the source texture identity changes', () => {
    const first = makeTexture();
    const second = makeTexture();
    const { result, rerender } = renderHook(({ tex }) => useCanvas2DTexture(tex), {
      initialProps: { tex: first as THREE.Texture | null },
    });
    const firstClone = result.current;
    rerender({ tex: second });
    expect(result.current).not.toBe(firstClone);
  });
});

describe('useCanvas2DTexture in a canvas', () => {
  it('clamps the clone before its upload, and draws it unchanged once uploaded', async () => {
    const { pending, wrapper } = fakeTiledUploads();
    const source = makeTexture();
    source.name = 'large';
    source.wrapS = source.wrapT = THREE.RepeatWrapping;
    const { result } = renderHook(() => useCanvas2DTexture(source), { wrapper });

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

describe('useCanvasDecodeDefines', () => {
  it('returns the sRGB-multiply define for a NoColorSpace texture', () => {
    const texture = makeTexture(THREE.NoColorSpace);
    const { result } = renderHook(() => useCanvasDecodeDefines(texture));
    expect(result.current).toEqual({ CANVAS_SRGB_MULTIPLY: '' });
  });

  it('returns undefined for an untouched (SRGBColorSpace) texture', () => {
    const texture = makeTexture(THREE.SRGBColorSpace);
    const { result } = renderHook(() => useCanvasDecodeDefines(texture));
    expect(result.current).toBeUndefined();
  });

  it('returns undefined for null/undefined (no map bound yet)', () => {
    const { result } = renderHook(({ tex }) => useCanvasDecodeDefines(tex), {
      initialProps: { tex: null as THREE.Texture | null },
    });
    expect(result.current).toBeUndefined();
  });

  it('keeps a stable identity across rerenders with the same texture', () => {
    const texture = makeTexture(THREE.NoColorSpace);
    const { result, rerender } = renderHook(({ tex }) => useCanvasDecodeDefines(tex), {
      initialProps: { tex: texture as THREE.Texture | null },
    });
    const first = result.current;
    rerender({ tex: texture });
    expect(result.current).toBe(first);
  });
});
