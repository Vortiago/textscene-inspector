import { describe, expect, it } from 'vitest';
import { CubeTexture, Data3DTexture, DataArrayTexture, Texture } from 'three';
import { levelsOf } from './textureLevels.js';

const generated = <T extends Texture>(texture: T): T => {
  texture.generateMipmaps = true;
  return texture;
};

describe('levelsOf', () => {
  it('counts the chain three generates from the size of a cube face', () => {
    const faces = Array.from({ length: 6 }, () => ({ width: 8, height: 8 }));
    expect(levelsOf(generated(new CubeTexture(faces as never)))).toBe(4);
  });

  it('halves the depth of a 3D texture with its levels', () => {
    expect(levelsOf(generated(new Data3DTexture(null, 2, 2, 16)))).toBe(5);
  });

  it('keeps every layer of a 2D array out of the count', () => {
    expect(levelsOf(generated(new DataArrayTexture(null, 2, 2, 16)))).toBe(2);
  });

  it('counts one level for a texture three generates no chain for', () => {
    expect(levelsOf(new DataArrayTexture(null, 8, 8, 1))).toBe(1);
  });
});
