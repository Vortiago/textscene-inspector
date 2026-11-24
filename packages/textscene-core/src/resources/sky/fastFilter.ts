import {
  FAST_FILTER_COEFFICIENTS,
  type FastFilterCoefficients,
} from '../../godot/rendering/environment/skyFastFilterCoefficients.js';
import { FAST_FILTER_CHAIN_SIZES } from '../../godot/rendering/environment/skyReflection.js';
import { LAYER_FILTER_UNIFORMS, type LayerFilter } from './layerFilter.js';
import { FAST_FILTER_FRAGMENT_SHADER } from './skyLayerShaders.js';
import { skyPass } from './skyPass.js';
import type * as THREE from 'three';
import { perObject } from '../../utils/perObject.js';

/** Each level of Godot's table, flattened as the shader's `vec4` arrays of the same names read it. */
const tapsByLevel = FAST_FILTER_COEFFICIENTS.map(
  (level) =>
    Object.fromEntries(
      Object.entries(level).map(([part, values]) => [part, Float32Array.from((values as number[][]).flat())])
    ) as Record<keyof FastFilterCoefficients, Float32Array>
);

const TAP_UNIFORMS = [...LAYER_FILTER_UNIFORMS, 'frameX', 'frameY', 'frameZ', 'lod', 'weight'];

/** Layer `n` takes the table's level `n - 1`: `sky.cpp:410-411`, `octmap_filter.glsl:80`. */
function tapsOf(layer: number): Record<keyof FastFilterCoefficients, Float32Array> {
  const taps = tapsByLevel[layer - 1];
  if (!taps) throw new Error(`expected a layer from 1 to ${tapsByLevel.length}, got ${layer}`);
  return taps;
}

function fastFilterPass(fragmentShader: string, uniformNames: readonly string[]) {
  return perObject<THREE.WebGLRenderer, THREE.ShaderMaterial>(() => skyPass(fragmentShader, uniformNames));
}

/** Into a sky's layers of one width, Godot's texture array path: `sky.cpp:1336`. */
export const fastFilterIntoLayers: LayerFilter = {
  chainSizes: FAST_FILTER_CHAIN_SIZES,
  passFor: fastFilterPass(`#define USE_TEXTURE_ARRAY\n${FAST_FILTER_FRAGMENT_SHADER}`, TAP_UNIFORMS),
  layerUniforms: tapsOf,
};

/** Into the mips of a probe's layer, Godot's path without arrays: `light_storage.cpp:1655`. */
export const fastFilterIntoMips: LayerFilter = {
  chainSizes: FAST_FILTER_CHAIN_SIZES,
  passFor: fastFilterPass(FAST_FILTER_FRAGMENT_SHADER, [...TAP_UNIFORMS, 'mipLevel']),
  layerUniforms: (layer) => ({ ...tapsOf(layer), mipLevel: layer - 1 }),
};
