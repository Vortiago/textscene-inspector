/**
 * What every lit program reads of the sky (`../godotSkyLighting.ts`): Godot's baked layers, which
 * each sky keeps in three cubes of its own, a group of layers a mip each, and the sky's share of the
 * ambient. Each scene with a sky shows its own before each of its renders, so a main view and a
 * sub-viewport with its own sky each light by their own.
 */

import * as THREE from 'three';
import { sharedTexture } from '../sharedTexture.js';
import { SKY_LAYER_GROUP_NAMES, type SkyLayers } from '../../resources/sky/skyLayers.js';
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
 * A sky's baked layers on one renderer, in cubes of its own as Godot keeps a radiance texture per sky
 * (`servers/rendering/renderer_rd/environment/sky.h:251`). The sky's environment owns the cubes, so
 * skies that take turns in one frame bake and upload nothing more.
 */
export class SkyLayerCubes {
  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly cubes: SkyLayers
  ) {}

  /**
   * Points every lit material at these cubes for the renders that follow, and puts `contribution`,
   * the sky's share of the ambient, in `skyContribution`. Each material holds a uniform of its own
   * (three r186 `UniformsUtils.js:24`), all on the one slot, so the slot takes the cube's handle, as
   * three's `XREstimatedLight.js:62-70` does: the switch uploads nothing.
   */
  show(contribution: number): void {
    skyContribution[0] = contribution;
    for (const group of SKY_LAYER_GROUP_NAMES) {
      this.handleOf(skyLayerSlots[group]).__webglTexture = this.handleOf(
        this.cubes[group].texture
      ).__webglTexture;
    }
  }

  /** Leaves no slot on these cubes before they are freed: binding a deleted texture is an error. */
  hide(): void {
    for (const group of SKY_LAYER_GROUP_NAMES) {
      const slot = this.handleOf(skyLayerSlots[group]);
      if (slot.__webglTexture === this.handleOf(this.cubes[group].texture).__webglTexture)
        delete slot.__webglTexture;
    }
  }

  private handleOf(texture: THREE.Texture): TextureHandle {
    return this.renderer.properties.get(texture) as TextureHandle;
  }
}
