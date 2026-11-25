import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as imagePixels from '../../resources/formats/image/imagePixels';
import type { AtlasSourceModel } from '../../resources/tileset/types';
import { useRuntimeAtlasTexture } from './paddedAtlasTexture';

const SOURCE: AtlasSourceModel = {
  texture: null,
  margins: { x: 0, y: 0 },
  separation: { x: 0, y: 0 },
  textureRegionSize: { x: 2, y: 2 },
  usesTexturePadding: true,
  tiles: new Map([['0:0', { sizeInAtlas: { x: 1, y: 1 }, alternatives: new Map() }]]),
};

function textureOf(): THREE.DataTexture {
  return new THREE.DataTexture(new Uint8Array(2 * 2 * 4).fill(255), 2, 2);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useRuntimeAtlasTexture', () => {
  it('reads the pixels again for the next run after a failed read', () => {
    const texture = textureOf();
    const read = vi.spyOn(imagePixels, 'readImagePixels').mockReturnValueOnce(undefined);

    const failed = renderHook(() => useRuntimeAtlasTexture(texture, SOURCE));
    const next = renderHook(() => useRuntimeAtlasTexture(texture, SOURCE));

    expect(failed.result.current).toBeNull();
    expect(next.result.current).toBeInstanceOf(THREE.DataTexture);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('shares one padded copy between the runs of a source', () => {
    const texture = textureOf();

    const first = renderHook(() => useRuntimeAtlasTexture(texture, SOURCE));
    const second = renderHook(() => useRuntimeAtlasTexture(texture, SOURCE));

    expect(second.result.current).toBe(first.result.current);
  });
});
