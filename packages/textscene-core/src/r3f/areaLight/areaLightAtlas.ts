/**
 * The one area light atlas every lit program samples, as Godot keeps one for every viewport
 * (4.7.2 `texture_storage.cpp:3330-3605`). Each AreaLight3D holds its `area_texture` while it
 * shows it, and the light pass rebuilds the atlas before a render when a texture joined it or
 * changed its pixels. `atlasLayout.ts` lays it out and `atlasMipmaps.ts` fills its mips.
 */

import * as THREE from 'three';
import { sharedTexture } from '../sharedTexture.js';
import { userDataDeclaration } from '../userDataDeclaration.js';
import {
  buildAreaLightAtlas,
  type AreaLightAtlas,
  type AreaTextureImage,
  type AreaTexturePlacement,
} from './atlasLayout.js';
import { mipSize } from './atlasMipmaps.js';
import { readImagePixels } from '../../resources/formats/image/imagePixels.js';
import { installLitUniform, installedUniformValue } from '../shaderPatch/litUniform.js';
import { AREA_LIGHT_ATLAS_UNIFORM } from './areaTextureFetch.js';
import { isBottomUp, reversedRows } from '../../utils/reversedRows.js';

/** The atlas every lit material and the fog pass sample, refilled in place. */
class AreaLightAtlasTexture extends sharedTexture(THREE.DataTexture) {
  constructor() {
    super(null, 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.name = 'AreaLightAtlas';
    this.generateMipmaps = false;
    this.minFilter = THREE.LinearMipmapLinearFilter;
    this.magFilter = THREE.LinearFilter;
  }

  /**
   * Holds `atlas`'s mips. A texture's GPU storage keeps its first size, so the old storage goes
   * before the new mips upload.
   */
  hold(atlas: AreaLightAtlas): void {
    this.dispose();
    this.mipmaps = atlas.mipmaps.map((data, level) => ({
      data,
      width: mipSize(atlas.width, level),
      height: mipSize(atlas.height, level),
    }));
    this.image = this.mipmaps[0] as unknown as typeof this.image;
    this.needsUpdate = true;
  }
}

/** The atlas an earlier evaluation of this module gave the lit materials, as after a dev server reloads it. */
const atlasTexture =
  (installedUniformValue(AREA_LIGHT_ATLAS_UNIFORM) as AreaLightAtlasTexture | undefined) ??
  new AreaLightAtlasTexture();

/** A held texture: its holders, and the pixel version the atlas last read. */
interface Held {
  users: number;
  version: number;
}

/**
 * Each held texture, in the order it joined, as Godot's map keeps it. Written only by
 * `holdAreaTexture`, `releaseAreaTexture` and `updateAreaLightAtlas`.
 */
const heldTextures = new Map<THREE.Texture, Held>();

/**
 * Where the last build placed each held texture it could read. Written by `updateAreaLightAtlas`,
 * and cleared of a texture the moment its last holder lets go.
 */
let placements = new Map<THREE.Texture, AreaTexturePlacement>();

/**
 * Whether a texture joined or changed its pixels since the last build. Godot leaves the pixels of
 * a texture that leaves in place until then.
 */
let isDirty = true;

/** The one atlas, an empty one until a texture joins it. Its identity never changes. */
export function areaLightAtlasTexture(): THREE.Texture {
  if (atlasTexture.mipmaps.length === 0) atlasTexture.hold(buildAreaLightAtlas([]));
  return atlasTexture;
}

/** Gives the atlas to every built-in lit material. */
export function installAreaLightAtlas(): void {
  installLitUniform(AREA_LIGHT_ATLAS_UNIFORM, areaLightAtlasTexture());
}

/** Puts `texture` in the atlas for one more holder (`texture_add_to_area_light_atlas`). */
export function holdAreaTexture(texture: THREE.Texture): void {
  const held = heldTextures.get(texture);
  if (held) {
    held.users++;
    return;
  }
  heldTextures.set(texture, { users: 1, version: texture.version });
  isDirty = true;
}

/** Lets go of `texture` for one holder. A stranger changes nothing. */
export function releaseAreaTexture(texture: THREE.Texture): void {
  const held = heldTextures.get(texture);
  if (!held) return;
  held.users--;
  if (held.users > 0) return;
  heldTextures.delete(texture);
  placements.delete(texture);
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
export const NO_AREA_TEXTURE: AreaTexturePlacement = { rect: [0, 0, 0, 0], maxMipmap: 0 };

/**
 * Where `light`'s texture lies in the atlas, or `NO_AREA_TEXTURE` for a light without one or a
 * texture the atlas does not hold.
 */
export function areaTexturePlacement(light: THREE.Object3D): AreaTexturePlacement {
  const texture = textureDeclaration.read(light);
  return (texture && placements.get(texture)) ?? NO_AREA_TEXTURE;
}

/** A texture's sRGB bytes with the top row first, as Godot's image holds it. */
function godotImage(texture: THREE.Texture): AreaTextureImage | undefined {
  const pixels = readImagePixels(texture.image);
  if (!pixels) return undefined;
  if (!isBottomUp(texture)) return pixels;
  return {
    width: pixels.width,
    height: pixels.height,
    data: reversedRows(pixels.data, pixels.width, pixels.height),
  };
}

/** Marks the atlas dirty when a held texture uploaded new pixels (`area_light_atlas_mark_dirty_on_texture`). */
function noteChangedPixels(): void {
  for (const [texture, held] of heldTextures) {
    if (held.version === texture.version) continue;
    held.version = texture.version;
    isDirty = true;
  }
}

/** Rebuilds the atlas when a texture joined or changed its pixels since the last build (`update_area_light_atlas`). */
export function updateAreaLightAtlas(): void {
  noteChangedPixels();
  if (!isDirty) return;
  isDirty = false;
  const readable = [...heldTextures.keys()].flatMap((texture) => {
    const image = godotImage(texture);
    return image ? [{ texture, image }] : [];
  });
  const atlas = buildAreaLightAtlas(readable.map(({ image }) => image));
  placements = new Map(readable.map(({ texture }, index) => [texture, atlas.placements[index]!]));
  atlasTexture.hold(atlas);
}
