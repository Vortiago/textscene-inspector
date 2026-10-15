/** What the sky bake asks of a filter, so one bake runs either of Godot's two filters. */

import type * as THREE from 'three';
import type { SkyOctmapLayout } from '../../godot/rendering/environment/skyReflection.js';

export interface LayerFilter {
  /** The layout of the radiance octmap the chain starts from. */
  readonly layout: SkyOctmapLayout;
  /** The width of each mip of the chain it reads, downsampled from the radiance. */
  readonly chainSizes: readonly number[];
  /** The pass that draws a layer on `renderer`. */
  passFor(renderer: THREE.WebGLRenderer): THREE.ShaderMaterial;
  /** The uniforms of the pass that differ from layer to layer. */
  layerUniforms(layer: number): Record<string, unknown>;
}

/** The uniforms of the filter passes that `skyLayers` sets, for the chain and the texel. */
export const LAYER_FILTER_UNIFORMS = ['chain', 'lastMip', 'borderSize', 'face', 'faceSize'] as const;
