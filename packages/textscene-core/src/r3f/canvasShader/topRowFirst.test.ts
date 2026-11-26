import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { useTopRowFirst } from './topRowFirst';

/** A 1x2 texture whose first stored row, the bottom one, is red, and whose top row is blue. */
function bottomUp(): THREE.DataTexture {
  return new THREE.DataTexture(new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]), 1, 2);
}

const storedOf = (texture: THREE.Texture | null) => Array.from((texture!.image as { data: Uint8Array }).data);

describe('useTopRowFirst', () => {
  it('stores the top row of a bottom-up texture first', () => {
    const { result } = renderHook(() => useTopRowFirst(bottomUp()));

    expect(storedOf(result.current)).toEqual([0, 0, 255, 255, 255, 0, 0, 255]);
  });

  it('leaves the bottom-up texture itself as it is', () => {
    const texture = bottomUp();

    renderHook(() => useTopRowFirst(texture));

    expect(storedOf(texture)).toEqual([255, 0, 0, 255, 0, 0, 255, 255]);
  });

  it('gives a texture that uploads with a flip as it is', () => {
    const texture = bottomUp();
    texture.flipY = true;

    const { result } = renderHook(() => useTopRowFirst(texture));

    expect(result.current).toBe(texture);
  });

  it('copies the texels again once the source is written', () => {
    const texture = bottomUp();
    const { result, rerender } = renderHook(() => useTopRowFirst(texture));
    (texture.image as { data: Uint8Array }).data.set([0, 255, 0, 255], 0);
    texture.needsUpdate = true;

    rerender();

    expect(storedOf(result.current).slice(4)).toEqual([0, 255, 0, 255]);
  });
});
