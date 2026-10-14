/**
 * How Godot lays out and filters a sky's radiance layers (`servers/rendering/renderer_rd/environment/sky.cpp`):
 * by GGX importance sampling in the high-quality modes, and by the fast filter in real-time mode.
 * Godot's sky ambient reads the last layer (`scene_forward_clustered.glsl:1744-1756`).
 */

/** The size each `Sky::RadianceSize` names, by its value (`scene/resources/sky.cpp:37-39`). */
export const SKY_RADIANCE_SIZES: readonly number[] = [32, 64, 128, 256, 512, 1024, 2048];

/** RADIANCE_SIZE_256, the default of `Sky.radiance_size` (`scene/resources/sky.h:61`). */
export const SKY_RADIANCE_SIZE_DEFAULT = 256;

/** `Sky::REAL_TIME_SIZE` (`sky.h:248`): a real-time sky bakes at this size whatever its `radiance_size`. */
export const REAL_TIME_RADIANCE_SIZE = 256;

/** `Sky::REAL_TIME_ROUGHNESS_LAYERS` (`sky.h:249`): a real-time sky has layers 0 to 6. */
export const REAL_TIME_ROUGHNESS_LAYERS = 7;

/**
 * The width of each mip of the copy the fast filter reads: 160 with five mips, whatever the
 * radiance size (`sky.cpp:341-343`).
 */
export const FAST_FILTER_CHAIN_SIZES: readonly number[] = [160, 80, 40, 20, 10];

/**
 * 1 / sqrt(3): a fast-filter frame weighs nothing where its axis is no nearer the direction than the
 * others (`octmap_filter.glsl:97-98`).
 */
export const FAST_FILTER_FRAME_LOWER_BOUND = 0.57735;

/** NUM_TAPS / 4 with the low-quality table's eight taps a frame (`octmap_filter.glsl:42-46`, `:155`). */
export const FAST_FILTER_SUPER_TAPS_PER_FRAME = 2;

/**
 * The default of `rendering/reflections/sky_reflections/roughness_layers`
 * (`servers/rendering/rendering_server.cpp:3727`). A reflection reads layer `sqrt(roughness)` times
 * the last layer's index, blending the two layers around it (`scene_forward_clustered.glsl:1714-1721`).
 */
export const SKY_ROUGHNESS_LAYERS_DEFAULT = 8;

/**
 * The default of `rendering/reflections/sky_reflections/ggx_samples`
 * (`servers/rendering/rendering_server.cpp:3730`), under the filter's cap of 64.
 */
const SKY_GGX_SAMPLES_DEFAULT = 32;

/** `GROUP_SIZE` squared: the filter rounds its sample count to whole workgroups (`octmap_roughness.glsl:7`). */
const WORKGROUP_SAMPLES = 64;

export interface SkyOctmapLayout {
  /** The width of each roughness layer's octmap, padding included. */
  size: number;
  /** The padding on each side, in UV. */
  padding: number;
  /** The width of each mip of the half-size radiance copy the roughness filter reads. */
  downsampledSizes: number[];
}

/**
 * The layout of the octmap array the radiance layers live in (`sky.cpp:1545-1559`), and of its
 * half-size copy with one mip fewer (`sky.cpp:338-343`).
 */
export function skyOctmapLayout(radianceSize: number): SkyOctmapLayout {
  // `get_image_required_mipmaps` + 1 counts the mips down to 1x1, and Godot drops two.
  const mipmaps = Math.log2(radianceSize) + 1 - 2;
  const paddingPixels = 2 ** (mipmaps - 1);
  const size = radianceSize * 2 + paddingPixels * 2;
  return {
    size,
    padding: paddingPixels / size,
    downsampledSizes: Array.from({ length: mipmaps - 1 }, (_, mip) => Math.max(1, (size / 2) >> mip)),
  };
}

export interface LayerSample {
  /** The sample's direction in the frame whose +Z is the texel's direction. */
  direction: readonly [number, number, number];
  /** The mip of the half-size copy it reads. */
  lod: number;
}

/**
 * The GGX samples that filter radiance layer `layer`, at the roughness `layer / 7` that `sky.cpp:473`
 * passes and `copy_effects.cpp:1357-1358` squares. Only the samples above
 * the horizon survive (`octmap_roughness.glsl:32-60`), and the filter weighs each by its cosine.
 * Layer 0 copies the radiance and takes no samples.
 */
export function layerSamples(layout: SkyOctmapLayout, layer: number): LayerSample[] {
  const roughness = (layer / (SKY_ROUGHNESS_LAYERS_DEFAULT - 1)) ** 2;
  const total = sampleTotal(roughness);
  const roughness4 = roughness ** 4;
  const solidAngleTexel = (4 * Math.PI) / (layout.size * layout.size);

  const f = Math.fround;
  const samples: LayerSample[] = [];
  for (let i = 0; i < total; i += 1) {
    const cosTheta = f(Math.sqrt(f((1 - radicalInverse(i)) / (1 + (roughness4 - 1) * radicalInverse(i)))));
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    const phi = (2 * Math.PI * i) / total;
    // In float32, as the GPU computes it: the sample at the horizon lands just below it.
    const z = f(f(2 * cosTheta) * cosTheta) - 1;
    if (z <= 0) continue;
    const direction: LayerSample['direction'] = [
      2 * cosTheta * sinTheta * Math.cos(phi),
      2 * cosTheta * sinTheta * Math.sin(phi),
      z,
    ];
    const pdf = distributionGGX(cosTheta, roughness4) / 4 + 0.0001;
    const solidAngleSample = 1 / (total * pdf + 0.0001);
    samples.push({ direction, lod: 0.5 * Math.log2(solidAngleSample / solidAngleTexel) });
  }
  return samples;
}

/**
 * The samples the filter takes at `roughness`, rounded up to whole workgroups
 * (`octmap_roughness.glsl:32-36`), of which only those above the horizon survive.
 */
function sampleTotal(roughness: number): number {
  const scaledSamples = Math.max(Math.floor(SKY_GGX_SAMPLES_DEFAULT * 4 * roughness), 4);
  return Math.max(1, Math.floor(scaledSamples / WORKGROUP_SAMPLES)) * WORKGROUP_SAMPLES;
}

/** The most samples any layer takes: the roughest layer's, at roughness 1. */
export const MOST_LAYER_SAMPLES = sampleTotal(1);

/** `DistributionGGX` (`octmap_roughness_inc.glsl:30-36`). */
function distributionGGX(cosTheta: number, roughness4: number): number {
  const denominator = cosTheta * cosTheta * (roughness4 - 1) + 1;
  return roughness4 / (Math.PI * denominator * denominator);
}

/**
 * `radicalInverse_VdC` (`octmap_roughness_inc.glsl:38-45`), the second Hammersley coordinate.
 * `scripts/godot-dfg/bake-dfg.mjs` holds a copy, since a build script cannot import this package.
 */
function radicalInverse(index: number): number {
  let bits = index >>> 0;
  bits = ((bits << 16) | (bits >>> 16)) >>> 0;
  bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
  bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
  bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
  bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
  return bits * 2.3283064365386963e-10;
}
