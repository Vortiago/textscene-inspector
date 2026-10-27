/**
 * The one area light atlas every lit program samples, as Godot keeps one for every viewport
 * (4.7.2 `texture_storage.cpp:3330-3605`). Each AreaLight3D holds its `area_texture` while it
 * shows it, and the light pass rebuilds the atlas before a render when a texture joined it or
 * changed its pixels. `atlasLayout.ts` lays it out and `atlasMipmaps.ts` fills its mips.
 */

import * as THREE from 'three';
import { releasedOnUnmount } from '../sharedTexture.js';
import { userDataDeclaration } from '../userDataDeclaration.js';
import { buildAreaLightAtlas, type AreaLightAtlas, type AreaTexturePlacement } from './atlasLayout.js';
import { mipSize } from '../../resources/processing/mipChain.js';
import { AtlasHolders } from '../textureAtlas/atlasHolders.js';
import { AtlasTexture, holdAtlasLevels } from '../textureAtlas/atlasTexture.js';
import { readableTextures } from '../textureAtlas/godotImage.js';
import { installLitUniform, installedUniformValue } from '../shaderPatch/litUniform.js';
import { AREA_LIGHT_ATLAS_UNIFORM } from './areaTextureFetch.js';

/**
 * The atlas every lit material and the fog pass sample, refilled in place. It is the one an earlier
 * evaluation of this module gave the lit materials, as after a dev server reloads it. A reload of
 * `sharedTexture.ts` starts an empty release list, so the reused atlas joins it.
 */
const atlasTexture = releasedOnUnmount(
  (installedUniformValue(AREA_LIGHT_ATLAS_UNIFORM) as AtlasTexture | undefined) ??
    new AtlasTexture('AreaLightAtlas', THREE.NoColorSpace)
);

function holdAtlas(atlas: AreaLightAtlas): void {
  holdAtlasLevels(
    atlasTexture,
    atlas.mipmaps.map((data, level) => ({
      data,
      width: mipSize(atlas.width, level),
      height: mipSize(atlas.height, level),
    }))
  );
}

/** Each held texture, as Godot's map keeps them. */
const holders = new AtlasHolders();

/**
 * Where the last build placed each held texture it could read. Written by `updateAreaLightAtlas`,
 * and cleared of a texture the moment its last holder lets go.
 */
let placements = new Map<THREE.Texture, AreaTexturePlacement>();

/** The one atlas, an empty one until a texture joins it. Its identity never changes. */
export function areaLightAtlasTexture(): THREE.Texture {
  if (atlasTexture.mipmaps.length === 0) holdAtlas(buildAreaLightAtlas([]));
  return atlasTexture;
}

/** Gives the atlas to every built-in lit material. */
export function installAreaLightAtlas(): void {
  installLitUniform(AREA_LIGHT_ATLAS_UNIFORM, areaLightAtlasTexture());
}

/** Puts `texture` in the atlas for one more holder (`texture_add_to_area_light_atlas`). */
export function holdAreaTexture(texture: THREE.Texture): void {
  holders.hold(texture);
}

/** Lets go of `texture` for one holder. A stranger changes nothing. */
export function releaseAreaTexture(texture: THREE.Texture): void {
  if (holders.release(texture)) placements.delete(texture);
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
  return (texture && placements.get(texture)) ?? NO_AREA_TEXTURE;
}

/** Rebuilds the atlas when a texture joined or changed its pixels since the last build (`update_area_light_atlas`). */
export function updateAreaLightAtlas(): void {
  const changed = holders.takeChanged();
  if (!changed) return;
  const readable = readableTextures(changed);
  const atlas = buildAreaLightAtlas(readable.map(({ image }) => image));
  placements = new Map(readable.map(({ texture }, index) => [texture, atlas.placements[index]!]));
  holdAtlas(atlas);
}
