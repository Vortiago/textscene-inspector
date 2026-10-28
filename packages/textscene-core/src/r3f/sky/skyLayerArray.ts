/**
 * What every lit program reads of the sky (`../godotSkyLighting.ts`): Godot's radiance layers, which
 * each sky keeps in an octmap array of its own, the array's layout, and the sky's share of the
 * ambient. Each scene with a sky shows its own before each of its renders, so a main view and a
 * sub-viewport with its own sky each light by their own.
 */

import * as THREE from 'three';
import { installedSlot, leaveSlot, showInSlot } from '../sharedTexture.js';
import type { SkyLayers } from '../../resources/sky/skyLayers.js';
import { installedOr } from '../shaderPatch/litUniform.js';

export const SKY_UNIFORMS = {
  /** The layer array every lit material samples. */
  layers: 'godotSkyLayers',
  /** The one-element `vec4` array of the shown sky's share of the ambient and its layout. */
  shown: 'godotShownSky',
} as const;

/**
 * The array a lit material samples the layers through. three never uploads it, as its version stays
 * 0 (three r186 `WebGLTextures.js:626`), and binds whatever handle it holds on a renderer: the array
 * of the sky shown last, or three's empty array.
 */
export const skyLayersSlot = installedSlot(SKY_UNIFORMS.layers, THREE.DataArrayTexture);

/**
 * The shown sky's `ambient_light_sky_contribution`, its layers' border size, the scale from a
 * squared screen derivative to squared texels, and its last mip. `UniformsUtils.cloneUniforms` keeps
 * a typed array by reference (three r186 `UniformsUtils.js:43-64`), so every material reads this
 * buffer. After a dev server reloads this module, it is the buffer the earlier evaluation installed.
 */
export const shownSky = installedOr(SKY_UNIFORMS.shown, Float32Array, () => Float32Array.of(1, 1, 1, 0));

/**
 * A sky's baked layers on one renderer, in an array of their own as Godot keeps a radiance texture
 * per sky (`servers/rendering/renderer_rd/environment/sky.h:251`). The sky's environment owns the
 * array, so skies that take turns in one frame bake and upload nothing more.
 */
export class SkyLayerArray {
  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly layers: SkyLayers
  ) {}

  /**
   * Points every lit material at this array for the renders that follow, and puts `contribution`,
   * the sky's share of the ambient, with the array's layout in `shownSky`. Each material holds a
   * uniform of its own (three r186 `UniformsUtils.js:24`), all on the one slot, so the slot takes the
   * array's handle.
   */
  show(contribution: number): void {
    const { borderSize, pixelSize, downsampledSizes } = this.layers.layout;
    shownSky[0] = contribution;
    shownSky[1] = borderSize;
    // One over `vec3_to_oct_lod`'s `pixel_size_sqr` (`oct_inc.glsl:46`), so a fragment multiplies.
    shownSky[2] = 1 / (4 * pixelSize * pixelSize);
    shownSky[3] = downsampledSizes.length;
    showInSlot(this.renderer, skyLayersSlot, this.layers.target.texture);
  }

  /** Leaves the slot off this array before it is freed. */
  hide(): void {
    leaveSlot(this.renderer, skyLayersSlot, this.layers.target.texture);
  }
}
