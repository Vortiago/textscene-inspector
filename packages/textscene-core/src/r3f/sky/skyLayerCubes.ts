/**
 * What every lit program reads of the sky (`../godotSkyLighting.ts`): Godot's baked layers, which
 * each sky keeps in three cubes of its own, a group of layers a mip each, and the sky's share of the
 * ambient. Each scene with a sky shows its own before each of its renders, so a main view and a
 * sub-viewport with its own sky each light by their own.
 */

import * as THREE from 'three';
import { sharedTexture } from '../sharedTexture.js';
import type { SkyLayers } from '../../resources/sky/skyLayers.js';
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
 * The cube a lit material samples a group of layers through. three never uploads it, as its version
 * stays 0 (three r186 `WebGLTextures.js:626`), and binds whatever handle it holds on a renderer:
 * the cube of the sky shown last, or three's black empty cube (`WebGLState.js:952`).
 */
class SkyLayerSlot extends sharedTexture(THREE.CubeTexture) {}

/**
 * A mip of an uncompressed cube as three uploads it (three r186 `WebGLTextures.js:1516-1543`). The
 * type of `CubeTexture.mipmaps` names only the shapes of other textures.
 */
interface CubeMip {
  image: THREE.DataTexture[];
}

/**
 * A cube of `layers`: the first as its faces and each later one as a mip. An uncompressed cube holds
 * its mips without the base level.
 */
function layerCube([first, ...later]: readonly Uint16Array[][]): THREE.CubeTexture {
  const cube = new THREE.CubeTexture(faceTextures(first!));
  const mips: CubeMip[] = later.map((faces) => ({ image: faceTextures(faces) }));
  cube.mipmaps = mips as unknown as THREE.CubeTexture['mipmaps'];
  cube.type = THREE.HalfFloatType;
  cube.format = THREE.RGBAFormat;
  cube.magFilter = THREE.LinearFilter;
  cube.minFilter = later.length > 0 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  cube.generateMipmaps = false;
  cube.needsUpdate = true;
  return cube;
}

/** Each RGBA face of a layer as a texture, its size read from its length. */
function faceTextures(faces: readonly Uint16Array[]): THREE.DataTexture[] {
  return faces.map((face) => {
    const size = Math.sqrt(face.length / 4);
    return new THREE.DataTexture(face, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
  });
}

/** The groups of layers, each shown as one cube. */
export const SKY_LAYER_GROUP_NAMES = Object.keys(SKY_LAYER_UNIFORMS) as readonly (keyof SkyLayers)[];

/** One value per group of layers, each made by `make`. */
function byGroup<T>(make: (group: keyof SkyLayers) => T): Record<keyof SkyLayers, T> {
  return Object.fromEntries(SKY_LAYER_GROUP_NAMES.map((group) => [group, make(group)])) as Record<
    keyof SkyLayers,
    T
  >;
}

/**
 * The slot each group of layers shows in, which every lit material samples. After a dev server
 * reloads this module, it is the slot the earlier evaluation installed, which every program compiled
 * since samples.
 */
export const skyLayerSlots = byGroup((group) => {
  const installed = installedUniformValue(SKY_LAYER_UNIFORMS[group]);
  return installed instanceof THREE.CubeTexture ? installed : new SkyLayerSlot();
});

const installedContribution = installedUniformValue(SKY_CONTRIBUTION_UNIFORM);

/**
 * `ambient_light_sky_contribution` of the scene being rendered. `UniformsUtils.cloneUniforms` keeps
 * a typed array by reference (three r186 `UniformsUtils.js:43-64`), so every material reads this
 * buffer. After a dev server reloads this module, it is the buffer the earlier evaluation installed.
 */
export const skyContribution =
  installedContribution instanceof Float32Array ? installedContribution : Float32Array.of(1);

/** The part of three's per-renderer state of a texture that holds its GL handle. */
interface TextureHandle {
  __webglTexture?: WebGLTexture;
}

/**
 * A sky's layers in cubes of its own on one renderer, as Godot keeps a radiance texture per sky
 * (`servers/rendering/renderer_rd/environment/sky.h:251`). Each cube uploads on the sky's first
 * show, so skies that take turns in one frame upload nothing more.
 */
export class SkyLayerCubes {
  private readonly cubes: Record<keyof SkyLayers, THREE.CubeTexture>;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    layers: SkyLayers
  ) {
    this.cubes = byGroup((group) => layerCube(layers[group]));
  }

  /**
   * Points every lit material at these cubes for the renders that follow, and puts `contribution`,
   * the sky's share of the ambient, in `skyContribution`. Each material holds a uniform of its own
   * (three r186 `UniformsUtils.js:24`), all on the one slot, so the slot takes the cube's handle, as
   * three's `XREstimatedLight.js:62-70` does: the switch uploads nothing.
   */
  show(contribution: number): void {
    skyContribution[0] = contribution;
    for (const group of SKY_LAYER_GROUP_NAMES) {
      const cube = this.handleOf(this.cubes[group]);
      // A restored context starts with no handle, so this uploads again after one.
      if (!cube.__webglTexture) this.renderer.initTexture(this.cubes[group]);
      this.handleOf(skyLayerSlots[group]).__webglTexture = cube.__webglTexture;
    }
  }

  /** Frees the cubes, and leaves no slot on a freed handle: binding a deleted texture is an error. */
  dispose(): void {
    for (const group of SKY_LAYER_GROUP_NAMES) {
      const slot = this.handleOf(skyLayerSlots[group]);
      if (slot.__webglTexture === this.handleOf(this.cubes[group]).__webglTexture) delete slot.__webglTexture;
      this.cubes[group].dispose();
    }
  }

  private handleOf(texture: THREE.Texture): TextureHandle {
    return this.renderer.properties.get(texture) as TextureHandle;
  }
}
