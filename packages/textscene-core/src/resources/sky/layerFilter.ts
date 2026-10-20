/** What the sky bake asks of a filter, so one bake runs either of Godot's two filters. */

import type * as THREE from 'three';

export interface LayerFilter {
  /** The width of each mip of the chain it reads, downsampled from the radiance. */
  readonly chainSizes: readonly number[];
  /** The pass that draws a layer on `renderer`. */
  passFor(renderer: THREE.WebGLRenderer): THREE.ShaderMaterial;
  /** The uniforms of the pass that differ from layer to layer. */
  layerUniforms(layer: number): Readonly<Record<string, Float32Array | number>>;
}

/** The uniforms of the filter passes that `skyLayers` sets, for the chain and the texel. */
export const LAYER_FILTER_UNIFORMS = ['chain', 'lastMip', 'borderSize', 'layerSize'] as const;
