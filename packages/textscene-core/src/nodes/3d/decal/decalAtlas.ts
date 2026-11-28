import * as THREE from 'three';
import type { TextureFilterState } from '../../../resources/textures/godotTextureFilter.js';
import { decalAtlasSlot } from '../../../r3f/decal/decalSlots.js';
import { fractionOfAtlas } from '../../../r3f/textureAtlas/atlasFraction.js';
import { createTextureAtlas } from '../../../r3f/textureAtlas/textureAtlas.js';
import { packDecalAtlas } from './decalAtlasLayout.js';
import { decalAtlasLevels } from './decalAtlasLevels.js';

const atlas = createTextureAtlas(
  {
    name: 'DecalAtlas',
    colorSpace: THREE.SRGBColorSpace,
    pack: packDecalAtlas,
    place: fractionOfAtlas,
    levels: decalAtlasLevels,
  },
  decalAtlasSlot.userData
);

export const {
  texture: decalAtlasTexture,
  hold: holdDecalTexture,
  release: releaseDecalTexture,
  placement: decalAtlasRect,
  update: updateDecalAtlas,
} = atlas;

export function setDecalAtlasFilter({ magFilter, minFilter, anisotropy }: TextureFilterState): void {
  const atlasTexture = decalAtlasTexture();
  if (
    atlasTexture.magFilter === magFilter &&
    atlasTexture.minFilter === minFilter &&
    atlasTexture.anisotropy === anisotropy
  )
    return;
  atlasTexture.magFilter = magFilter;
  atlasTexture.minFilter = minFilter;
  atlasTexture.anisotropy = anisotropy;
  atlasTexture.needsUpdate = true;
}
