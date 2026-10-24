import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { MipLevel } from '../../resources/processing/mipChain';
import { AtlasTexture, holdAtlasLevels } from './atlasTexture';

/** A chain of `count` levels from `size` × `size`, each half the one before. */
function chain(size: number, count: number): MipLevel[] {
  return Array.from({ length: count }, (_, level) => {
    const side = size >> level;
    return { data: new Uint8Array(side * side * 4), width: side, height: side };
  });
}

function atlas(): AtlasTexture {
  return new AtlasTexture('Atlas', THREE.NoColorSpace);
}

describe('holdAtlasLevels', () => {
  it('holds the chain, shows its largest level, and asks for an upload', () => {
    const texture = atlas();
    const levels = chain(8, 4);
    const version = texture.version;

    holdAtlasLevels(texture, levels);

    expect(texture.mipmaps).toEqual(levels);
    expect(texture.image).toBe(levels[0]);
    expect(texture.generateMipmaps).toBe(false);
    expect(texture.version).toBe(version + 1);
  });

  it('drops the old GPU storage when the size changes, and not when it stays', () => {
    const texture = atlas();
    const dispose = vi.spyOn(texture, 'dispose');
    holdAtlasLevels(texture, chain(8, 4));
    dispose.mockClear();

    holdAtlasLevels(texture, chain(8, 4));
    expect(dispose).not.toHaveBeenCalled();

    holdAtlasLevels(texture, chain(16, 4));
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('refuses a single level, which is no chain (error case)', () => {
    expect(() => holdAtlasLevels(atlas(), chain(8, 1))).toThrow('expected at least 2 atlas levels, got 1');
  });
});
