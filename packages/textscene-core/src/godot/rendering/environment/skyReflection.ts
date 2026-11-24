/** `Sky::REAL_TIME_SIZE` (`sky.h:248`): a real-time sky bakes at this size whatever its `radiance_size`. */
export const REAL_TIME_RADIANCE_SIZE = 256;

/** `Sky::REAL_TIME_ROUGHNESS_LAYERS` (`sky.h:249`): a real-time sky has layers 0 to 6. */
export const REAL_TIME_ROUGHNESS_LAYERS = 7;

/**
 * The width of each mip of the copy the fast filter reads: 160 with five mips, whatever the
 * radiance size (`sky.cpp:341-343`).
 */
export const FAST_FILTER_CHAIN_SIZES: readonly number[] = [160, 80, 40, 20, 10];

/** The table the fast filter reads, by `rendering/reflections/sky_reflections/fast_filter_high_quality`. */
export type FastFilterQuality = 'low' | 'high';

/** Godot's default of `fast_filter_high_quality`, false (`rendering_server.cpp:3732`). */
export const DEFAULT_FAST_FILTER_QUALITY: FastFilterQuality = 'low';

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
export const SKY_GGX_SAMPLES_DEFAULT = 32;

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

/**
 * A sky's octmap array, whose every layer has a mip chain of its own: the layer's own width, then
 * each of `downsampledSizes`.
 */
export interface SkyRadianceLayout extends SkyOctmapLayout {
  /**
   * `radiance_pixel_size`, one over the radiance size (`renderer_scene_render_rd.cpp:1395-1396`): a
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
