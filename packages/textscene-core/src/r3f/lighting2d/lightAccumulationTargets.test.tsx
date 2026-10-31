/**
 * The 2D light accumulator is a 32-bit float where the renderer can blend into one, and a half float
 * where it cannot: WebGL2 blends into a float attachment only with `EXT_float_blend`.
 */
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { useAccumulationTargets } from './lightAccumulationTargets.js';

const renderer = vi.hoisted(() => ({ extensions: { has: (_name: string) => true } }));
vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: { gl: typeof renderer }) => unknown) => select({ gl: renderer }),
}));

function textureTypeWith(extensions: readonly string[]): THREE.TextureDataType | undefined {
  renderer.extensions.has = (name) => extensions.includes(name);
  const { result } = renderHook(() => useAccumulationTargets(['list']));
  return result.current.get('list')?.texture.type;
}

describe('useAccumulationTargets', () => {
  it('accumulates in a 32-bit float where the renderer blends into one', () => {
    expect(textureTypeWith(['EXT_float_blend'])).toBe(THREE.FloatType);
  });

  it('accumulates in a half float where the renderer cannot blend into a float', () => {
    expect(textureTypeWith([])).toBe(THREE.HalfFloatType);
  });
});
