import * as THREE from 'three';
import { userDataDeclaration } from '../userDataDeclaration.js';
import { createTextureAtlas } from '../textureAtlas/textureAtlas.js';
import {
  areaAtlasLevels,
  areaPlacement,
  buildAreaLightAtlas,
  type AreaTexturePlacement,
} from './atlasLayout.js';
import { installLitUniform, installedUniformValue } from '../shaderPatch/litUniform.js';
import { AREA_LIGHT_ATLAS_UNIFORM } from './areaTextureFetch.js';

const atlas = createTextureAtlas(
  {
    name: 'AreaLightAtlas',
    colorSpace: THREE.NoColorSpace,
    pack: buildAreaLightAtlas,
    place: areaPlacement,
    levels: areaAtlasLevels,
  },
  { atlasTexture: installedUniformValue(AREA_LIGHT_ATLAS_UNIFORM) as THREE.DataTexture | undefined }
);

export const {
  texture: areaLightAtlasTexture,
  hold: holdAreaTexture,
  release: releaseAreaTexture,
  update: updateAreaLightAtlas,
} = atlas;

export function installAreaLightAtlas(): void {
  installLitUniform(AREA_LIGHT_ATLAS_UNIFORM, areaLightAtlasTexture());
}

const textureDeclaration = userDataDeclaration<THREE.Texture>(
  'godotAreaTexture',
  (candidate) => (candidate as Partial<THREE.Texture>).isTexture === true
);

/** The `userData` through which a `RectAreaLight` carries its `area_texture` to the light pass. */
export function areaTextureUserData(texture: THREE.Texture | null): Record<string, unknown> {
  return texture ? textureDeclaration.userData(texture) : {};
}

/** An empty rectangle marks a light without a texture (4.7.2 `light_storage.cpp:1132-1141`). */
const NO_AREA_TEXTURE: AreaTexturePlacement = {
  rect: { x: 0, y: 0, width: 0, height: 0 },
  maxMipmap: 0,
};

/**
 * Where `light`'s texture lies in the atlas, or `NO_AREA_TEXTURE` for a light without one or a
 * texture the atlas does not hold.
 */
export function areaTexturePlacement(light: THREE.Object3D): AreaTexturePlacement {
  const texture = textureDeclaration.read(light);
  return (texture && atlas.placement(texture)) ?? NO_AREA_TEXTURE;
}
