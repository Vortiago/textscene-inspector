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

/** Each level of Godot's table flattened as the shader's `vec4` arrays read it, with Godot's `mip_level`. */
const uniformsByLevel = FAST_FILTER_COEFFICIENTS.map((level, mipLevel) => ({
  ...(Object.fromEntries(
    Object.entries(level).map(([part, values]) => [part, Float32Array.from((values as number[][]).flat())])
  ) as Record<keyof FastFilterCoefficients, Float32Array>),
  mipLevel,
}));

const FAST_FILTER_UNIFORMS = [
  ...LAYER_FILTER_UNIFORMS,
  'frameX',
  'frameY',
  'frameZ',
  'lod',
  'weight',
  'mipLevel',
];

/** Layer `n` takes the table's level `n - 1`: `sky.cpp:410-411`, `octmap_filter.glsl:80`. */
function layerUniforms(layer: number): (typeof uniformsByLevel)[number] {
  const uniforms = uniformsByLevel[layer - 1];
  if (!uniforms) throw new Error(`expected a layer from 1 to ${uniformsByLevel.length}, got ${layer}`);
  return uniforms;
}

function fastFilterWith(defines: string): LayerFilter {
  return {
    chainSizes: FAST_FILTER_CHAIN_SIZES,
    passFor: perObject<THREE.WebGLRenderer, THREE.ShaderMaterial>(() =>
      skyPass(defines + FAST_FILTER_FRAGMENT_SHADER, FAST_FILTER_UNIFORMS)
    ),
    layerUniforms,
  };
}

/** Into a sky's layers of one width, Godot's texture array path: `sky.cpp:1336`. */
export const fastFilterIntoLayers = fastFilterWith('#define USE_TEXTURE_ARRAY\n');

/** Into the mips of a probe's layer, Godot's path without arrays: `light_storage.cpp:1655`. */
export const fastFilterIntoMips = fastFilterWith('');
