/**
 * The 2D light accumulator is a 32-bit float where the renderer can blend into one, and a half float
 * where it cannot: WebGL2 blends into a float attachment only with `EXT_float_blend` and filters
 * a float texture only with `OES_texture_float_linear`.
 */
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { useAccumulationTargets, useLayeredAccumulationTargets } from './lightAccumulationTargets.js';

const renderer = vi.hoisted(() => ({
  extensions: { has: (_name: string): boolean => false },
}));
vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: { gl: typeof renderer }) => unknown) => select({ gl: renderer }),
}));

function textureTypeWith(extensions: readonly string[]): THREE.TextureDataType | undefined {
  renderer.extensions.has = (name) => extensions.includes(name);
  const { result } = renderHook(() => useAccumulationTargets(new Map([['list', 1]])));
  return result.current.get('list')?.texture.type;
}

describe('useAccumulationTargets', () => {
  it('accumulates in a 32-bit float where the renderer blends into one and filters it', () => {
    expect(textureTypeWith(['EXT_float_blend', 'OES_texture_float_linear'])).toBe(THREE.FloatType);
  });

  it('accumulates in a half float where the renderer cannot filter a float texture', () => {
    expect(textureTypeWith(['EXT_float_blend'])).toBe(THREE.HalfFloatType);
  });

  it('accumulates in a half float where the renderer cannot blend into a float', () => {
    expect(textureTypeWith([])).toBe(THREE.HalfFloatType);
  });
});

describe('the attachments of a target', () => {
  it('holds one texture per attachment, each of the accumulator type, raw and clamped', () => {
    renderer.extensions.has = () => true;
    const { result } = renderHook(() => useAccumulationTargets(new Map([['list', 3]])));
    const { textures } = result.current.get('list')!;
    expect(textures).toHaveLength(3);
    for (const texture of textures) {
      expect(texture.type).toBe(THREE.FloatType);
      expect(texture.colorSpace).toBe(THREE.NoColorSpace);
      expect(texture.minFilter).toBe(THREE.LinearFilter);
      expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
    }
  });

  it('gives a layered target the layers and the attachments asked for', () => {
    renderer.extensions.has = () => true;
    const { result } = renderHook(() =>
      useLayeredAccumulationTargets(new Map([['list', { layers: 4, attachments: 2 }]]))
    );
    const target = result.current.get('list')!;
    expect([target.depth, target.textures.length]).toEqual([4, 2]);
    expect(target.textures[1]!.type).toBe(THREE.FloatType);
  });
});
