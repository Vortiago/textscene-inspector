import { CubeTexture, Data3DTexture, DataArrayTexture, DataTexture, LinearFilter, type Texture } from 'three';
import type { TextureKind } from '../language/types.js';
import { DEFAULT_TEXELS, type DefaultTexture } from './samplerTextures.js';

/** Godot's defaults are 4 by 4 texels of one level, 4 deep for a 3D texture (`texture_storage.cpp:85`). */
const SIZE = 4;

/** The texels of `count` faces or slices of 4 by 4, each texel `texel`. */
function texels(texture: DefaultTexture, count: number): Uint8Array {
  const texel = DEFAULT_TEXELS[texture];
  return Uint8Array.from({ length: SIZE * SIZE * count * 4 }, (_, index) => texel[index % 4]!);
}

function created(kind: TextureKind, fill: DefaultTexture): Texture {
  switch (kind) {
    case 'flat':
      return new DataTexture(texels(fill, 1), SIZE, SIZE);
    case 'volume':
      return new Data3DTexture(texels(fill, SIZE), SIZE, SIZE, SIZE);
    case 'layers':
      return new DataArrayTexture(texels(fill, 1), SIZE, SIZE, 1);
    case 'cubes':
      return new DataArrayTexture(texels(fill, 6), SIZE, SIZE, 6);
    case 'cube':
      return new CubeTexture(Array.from({ length: 6 }, () => new DataTexture(texels(fill, 1), SIZE, SIZE)));
  }
}

/** A new default texture of `kind` that holds `texture`'s texels. Its caller owns and frees it. */
export function defaultTexture(kind: TextureKind, texture: DefaultTexture): Texture {
  const made = created(kind, texture);
  made.generateMipmaps = false;
  made.minFilter = LinearFilter;
  made.needsUpdate = true;
  return made;
}
