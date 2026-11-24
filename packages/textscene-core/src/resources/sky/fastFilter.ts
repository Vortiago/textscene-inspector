import * as THREE from 'three';
import {
  FAST_FILTER_COEFFICIENTS,
  type FastFilterCoefficients,
} from '../../godot/rendering/environment/skyFastFilterCoefficients.js';
import { FAST_FILTER_HIGH_QUALITY_COEFFICIENTS } from '../../godot/rendering/environment/skyFastFilterHighQualityCoefficients.js';
import {
  FAST_FILTER_CHAIN_SIZES,
  FAST_FILTER_HIGH_QUALITY_SUPER_TAPS_PER_FRAME,
  type FastFilterQuality,
} from '../../godot/rendering/environment/skyReflection.js';
import { LAYER_FILTER_UNIFORMS, type LayerFilter } from './layerFilter.js';
import { FAST_FILTER_FRAGMENT_SHADER } from './skyLayerShaders.js';
import { skyPass } from './skyPass.js';
import { perObject } from '../../utils/perObject.js';
import { releasedOnUnmount } from '../../r3f/sharedTexture.js';

/** Godot's fast filter into a sky's layers and into a probe's mips, from one of its two tables. */
export interface FastFilters {
  /** Into a sky's layers of one width, Godot's texture array path: `sky.cpp:1336`. */
  readonly intoLayers: LayerFilter;
  /** Into the mips of a probe's layer, Godot's path without arrays: `light_storage.cpp:1655`. */
  readonly intoMips: LayerFilter;
}

const TEXTURE_ARRAY = '#define USE_TEXTURE_ARRAY\n';
const HIGH_QUALITY = '#define USE_HIGH_QUALITY\n';

/** Each level of Godot's low-quality table, flat, as the shader's `vec4` arrays of those names read it. */
const tapsByLevel = FAST_FILTER_COEFFICIENTS.map(
  (level) =>
    Object.fromEntries(
      Object.entries(level).map(([part, values]) => [part, Float32Array.from((values as number[][]).flat())])
    ) as Record<keyof FastFilterCoefficients, Float32Array>
);

const TAP_UNIFORMS = [...LAYER_FILTER_UNIFORMS, 'frameX', 'frameY', 'frameZ', 'lod', 'weight'];
const HIGH_QUALITY_UNIFORMS = [...LAYER_FILTER_UNIFORMS, 'coefficients', 'mipLevel'];

/** Godot's levels 0 to 5: layer `n` takes level `n - 1` (`sky.cpp:410-411`, `octmap_filter.glsl:80`). */
function mipLevelOf(layer: number): number {
  if (layer < 1 || layer > tapsByLevel.length)
    throw new Error(`expected a layer from 1 to ${tapsByLevel.length}, got ${layer}`);
  return layer - 1;
}

function tapsOf(layer: number): Record<keyof FastFilterCoefficients, Float32Array> {
  return tapsByLevel[mipLevelOf(layer)]!;
}

/** Written only on its first read, and freed with each canvas that unmounts. */
let highQualityTable: THREE.DataTexture | undefined;

/** The high-quality table, a super-tap a texel and a term of a part a row (`octmap_filter.glsl:62`). */
function highQualityCoefficients(): THREE.DataTexture {
  if (highQualityTable) return highQualityTable;
  const width = FAST_FILTER_HIGH_QUALITY_SUPER_TAPS_PER_FRAME * 3;
  const texels = Float32Array.from(FAST_FILTER_HIGH_QUALITY_COEFFICIENTS);
  const table = new THREE.DataTexture(
    texels,
    width,
    texels.length / 4 / width,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  table.needsUpdate = true;
  highQualityTable = releasedOnUnmount(table);
  return highQualityTable;
}

function passFor(defines: string, uniformNames: readonly string[]) {
  return perObject<THREE.WebGLRenderer, THREE.ShaderMaterial>(() =>
    skyPass(defines + FAST_FILTER_FRAGMENT_SHADER, uniformNames)
  );
}

const LOW_QUALITY_FILTERS: FastFilters = {
  intoLayers: {
    chainSizes: FAST_FILTER_CHAIN_SIZES,
    passFor: passFor(TEXTURE_ARRAY, TAP_UNIFORMS),
    layerUniforms: tapsOf,
  },
  intoMips: {
    chainSizes: FAST_FILTER_CHAIN_SIZES,
    passFor: passFor('', [...TAP_UNIFORMS, 'mipLevel']),
    layerUniforms: (layer) => ({ ...tapsOf(layer), mipLevel: mipLevelOf(layer) }),
  },
};

const highQualityUniforms = (layer: number) => ({
  coefficients: highQualityCoefficients(),
  mipLevel: mipLevelOf(layer),
});

const HIGH_QUALITY_FILTERS: FastFilters = {
  intoLayers: {
    chainSizes: FAST_FILTER_CHAIN_SIZES,
    passFor: passFor(HIGH_QUALITY + TEXTURE_ARRAY, HIGH_QUALITY_UNIFORMS),
    layerUniforms: highQualityUniforms,
  },
  intoMips: {
    chainSizes: FAST_FILTER_CHAIN_SIZES,
    passFor: passFor(HIGH_QUALITY, HIGH_QUALITY_UNIFORMS),
    layerUniforms: highQualityUniforms,
  },
};

/** The filters of each `fast_filter_high_quality` setting: `copy_effects.cpp:196-204`. */
export const FAST_FILTERS: Readonly<Record<FastFilterQuality, FastFilters>> = {
  low: LOW_QUALITY_FILTERS,
  high: HIGH_QUALITY_FILTERS,
};
