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

/** The blurriest radiance layer, the default layers less one (`render_forward_clustered.cpp:4998`). */
export const MAX_ROUGHNESS_LOD = SKY_ROUGHNESS_LAYERS_DEFAULT - 1;

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
  /** The width inside the padding, in UV: `oct_inc.glsl`'s `border_size`. */
  borderSize: number;
  /** The width of each roughness layer's octmap, from layer 0, which the radiance fills. */
  layerSizes: number[];
  /** The width of each mip of the half-size radiance copy the roughness filter reads. */
  downsampledSizes: number[];
}

/** A sky's octmap array, whose every layer has a mip chain of its own. */
export interface SkyRadianceLayout extends SkyOctmapLayout {
  /** The width of each mip of every layer, from the layer's own width. */
  mipSizes: number[];
  /**
   * `radiance_pixel_size`, one over the radiance size (`renderer_scene_render_rd.cpp:1394-1396`): a
   * read picks its mip from the screen derivatives of its direction in these units.
   */
  pixelSize: number;
}

/**
 * The layout of the octmap array of `layers` radiance layers, each as wide as the radiance's octmap
 * with a mip chain of its own (`sky.cpp:1545-1559`, `:289-310`), and of its half-size copy with one
 * mip fewer (`sky.cpp:339-343`).
 */
export function skyOctmapLayout(radianceSize: number, layers: number): SkyRadianceLayout {
  // `get_image_required_mipmaps` + 1 counts the mips down to 1x1, and Godot drops two.
  const mipmaps = Math.log2(radianceSize) + 1 - 2;
  const { size, borderSize } = paddedOctmap(radianceSize, 2 ** (mipmaps - 1));
  return {
    size,
    borderSize,
    layerSizes: Array.from({ length: layers }, () => size),
    downsampledSizes: halvingSizes(size >> 1, mipmaps - 1),
    mipSizes: halvingSizes(size, mipmaps),
    pixelSize: 1 / radianceSize,
  };
}

/**
 * The octmap of a capture `captureSize` wide: twice as wide, to match a cube's texel density, in a
 * border of `paddingPixels` on each side, which `oct_inc.glsl`'s `border_size` leaves out in UV.
 */
export function paddedOctmap(
  captureSize: number,
  paddingPixels: number
): { size: number; borderSize: number } {
  const size = captureSize * 2 + paddingPixels * 2;
  return { size, borderSize: 1 - (paddingPixels * 2) / size };
}

/** `count` mip widths from `first`, each half the one before and at least one texel. */
export function halvingSizes(first: number, count: number): number[] {
  return Array.from({ length: count }, (_, mip) => Math.max(1, first >> mip));
}

interface LayerSample {
  /** The sample's direction in the frame whose +Z is the texel's direction. */
  direction: readonly [number, number, number];
  /** The mip of the half-size copy it reads. */
  lod: number;
}

/**
 * The GGX samples that filter radiance layer `layer`, at the roughness `layer` over the last layer's
 * index that `sky.cpp:473-475` passes and `copy_effects.cpp:1357-1358` squares. Each sample's mip
 * follows from the texel size of the layer it fills (`octmap_roughness.glsl:30`). Only the samples
 * above the horizon survive (`:32-60`), and the filter weighs each by its cosine. Layer 0 copies the
 * radiance and takes no samples.
 */
export function layerSamples(layout: SkyOctmapLayout, layer: number): LayerSample[] {
  const { layerSizes } = layout;
  const layerSize = layerSizes[layer];
  if (layerSize === undefined)
    throw new Error(`expected a layer from 0 to ${layerSizes.length - 1}, got ${layer}`);
  const roughness = (layer / (layerSizes.length - 1)) ** 2;
  const total = sampleTotal(roughness);
  const roughness4 = roughness ** 4;
  const solidAngleTexel = (4 * Math.PI) / (layerSize * layerSize);

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
