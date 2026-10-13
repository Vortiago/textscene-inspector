/**
 * What every lit program reads of the sky (`../godotSkyLighting.ts`): Godot's baked layers in three
 * cubes, each holding a group of layers a mip each, and the sky's share of the ambient. Each scene
 * with a sky shows its own before each of its renders, so a main view and a sub-viewport with its
 * own sky each light by their own.
 */

import * as THREE from 'three';
import { SKY_LAYER_GROUPS, type SkyLayers } from '../../resources/sky/skyLayers.js';
import { installedUniformValue } from '../shaderPatch/litUniform.js';

/** The uniform every lit material samples each group of layers through, a mip each. */
export const SKY_LAYER_UNIFORMS: Record<keyof SkyLayers, string> = {
  sharp: 'godotSkySharpLayersMap',
  rough: 'godotSkyRoughLayersMap',
  last: 'godotSkyLastLayerMap',
};

/** The one-element array uniform every lit material reads the sky's share of the ambient from. */
export const SKY_CONTRIBUTION_UNIFORM = 'godotSkyContribution';

/**
 * `cloneUniforms` clones a texture for each material (three r186 `UniformsUtils.js:28-39`), and a
 * clone would hold the layers it was cloned with. So a clone of this texture is the texture itself.
 * Black layers of `faceSizes` fill it until a sky shows its own: three allocates the cube at those
 * sizes on its first upload, and later layers have the same sizes.
 */
class SkyLayerTexture extends THREE.CubeTexture {
  constructor(faceSizes: readonly number[]) {
    super();
    this.type = THREE.HalfFloatType;
    this.format = THREE.RGBAFormat;
    this.magFilter = THREE.LinearFilter;
    this.minFilter = faceSizes.length > 1 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    this.generateMipmaps = false;
    showLayers(
      this,
      faceSizes.map((size) => Array.from({ length: 6 }, () => new Uint16Array(size * size * 4)))
    );
  }

  override clone(): this {
    return this;
  }
}

/**
 * A mip of an uncompressed cube as three uploads it (three r186 `WebGLTextures.js:1516-1543`). The
 * type of `CubeTexture.mipmaps` names only the shapes of other textures.
 */
interface CubeMip {
  image: THREE.DataTexture[];
}

/**
 * Puts `layers` in `cube`: the first as its faces and each later one as a mip. An uncompressed cube
 * holds its mips without the base level.
 */
function showLayers(cube: THREE.CubeTexture, [first, ...later]: readonly Uint16Array[][]): void {
  cube.image = faceTextures(first!);
  const mips: CubeMip[] = later.map((faces) => ({ image: faceTextures(faces) }));
  cube.mipmaps = mips as unknown as THREE.CubeTexture['mipmaps'];
  cube.needsUpdate = true;
}

/** Each RGBA face of a layer as a texture, its size read from its length. */
function faceTextures(faces: readonly Uint16Array[]): THREE.DataTexture[] {
  return faces.map((face) => {
    const size = Math.sqrt(face.length / 4);
    return new THREE.DataTexture(face, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
  });
}

/**
 * The cube an earlier evaluation of this module gave the lit materials under `uniform`, as after a
 * dev server reloads it. Every program compiled since samples that cube, so this evaluation writes
 * into it.
 */
function installedCube(uniform: string): THREE.CubeTexture | null {
  const installed = installedUniformValue(uniform);
  return installed instanceof THREE.CubeTexture ? installed : null;
}

/** The cube each group of layers shows in. */
export const skyLayerMaps = {
  sharp: layerCube('sharp'),
  rough: layerCube('rough'),
  last: layerCube('last'),
} as const satisfies Record<keyof SkyLayers, THREE.CubeTexture>;

function layerCube(group: keyof SkyLayers): THREE.CubeTexture {
  return installedCube(SKY_LAYER_UNIFORMS[group]) ?? new SkyLayerTexture(SKY_LAYER_GROUPS[group].faceSizes);
}

const installedContribution = installedUniformValue(SKY_CONTRIBUTION_UNIFORM);

/**
 * `ambient_light_sky_contribution` of the scene being rendered. `UniformsUtils.cloneUniforms` keeps
 * a typed array by reference (three r186 `UniformsUtils.js:43-64`), so every material reads this
 * buffer. After a dev server reloads this module, it is the buffer the earlier evaluation installed.
 */
export const skyContribution =
  installedContribution instanceof Float32Array ? installedContribution : Float32Array.of(1);

/** The layers the cubes hold now. Written only by `showSkyLayers`. */
let shownLayers: SkyLayers | null = null;

/**
 * Puts `layers`, as `skyLayers` lays them out, in the cubes, and `contribution`, the sky's share of
 * the ambient, in `skyContribution`. Layers the cubes already hold upload nothing, so a still scene
 * writes nothing.
 */
export function showSkyLayers(layers: SkyLayers, contribution: number): void {
  skyContribution[0] = contribution;
  if (layers === shownLayers) return;
  shownLayers = layers;
  showLayers(skyLayerMaps.sharp, layers.sharp);
  showLayers(skyLayerMaps.rough, layers.rough);
  showLayers(skyLayerMaps.last, layers.last);
}
