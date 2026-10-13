/**
 * How Godot lays out and filters a sky's radiance layers in high-quality mode, the mode of every
 * sky whose shader reads no `TIME` (`servers/rendering/renderer_rd/environment/sky.cpp`). Godot's
 * sky ambient reads the last layer (`scene_forward_clustered.glsl:1744-1756`).
 */

import { octToVec3WithBorder, type OctDirection } from './octmap.js';

/** RADIANCE_SIZE_256, the default of `Sky.radiance_size` (`scene/resources/sky.h:61`). */
export const SKY_RADIANCE_SIZE_DEFAULT = 256;

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

export interface OctmapTap {
  u: number;
  v: number;
  weight: number;
}

/**
 * The four bilinear taps `octmap_downsampler.glsl:53-75` blends for texel `x`, `y` of a mip `size`
 * wide, in UV of the mip above. Each weighs half by the octahedral Jacobian and half evenly.
 */
export function downsampleTaps(x: number, y: number, size: number, padding: number): OctmapTap[] {
  const borderSize = 1 - padding * 2;
  const near = (index: number) => ((index * 2 + 1 - 0.75) / size - 1) * 0.5 + 0.5;
  const far = (index: number) => ((index * 2 + 1 + 0.75) / size - 1) * 0.5 + 0.5;
  const taps: OctmapTap[] = [
    tap(near(x), near(y), borderSize),
    tap(far(x), near(y), borderSize),
    tap(near(x), far(y), borderSize),
    tap(far(x), far(y), borderSize),
  ];
  const scale = 0.5 / (taps[0]!.weight + taps[1]!.weight + taps[2]!.weight + taps[3]!.weight);
  for (const each of taps) each.weight = each.weight * scale + 0.125;
  return taps;
}

/** A tap at `u`, `v`, weighed by `calcWeight` (`octmap_downsampler.glsl:46-49`) before the blend. */
function tap(u: number, v: number, borderSize: number): OctmapTap {
  const [, , z] = octToVec3WithBorder(u, v, borderSize);
  return { u, v, weight: 1 / (Math.abs(z) + 1) ** 3 };
}

export interface LayerSample {
  /** The sample's direction in the frame whose +Z is the texel's direction. */
  direction: OctDirection;
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
  const scaledSamples = Math.max(Math.floor(SKY_GGX_SAMPLES_DEFAULT * 4 * roughness), 4);
  const total = Math.max(1, Math.floor(scaledSamples / WORKGROUP_SAMPLES)) * WORKGROUP_SAMPLES;
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
    const direction: OctDirection = [
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

/** `DistributionGGX` (`octmap_roughness_inc.glsl:30-36`). */
function distributionGGX(cosTheta: number, roughness4: number): number {
  const denominator = cosTheta * cosTheta * (roughness4 - 1) + 1;
  return roughness4 / (Math.PI * denominator * denominator);
}

/** `radicalInverse_VdC` (`octmap_roughness_inc.glsl:38-45`), the second Hammersley coordinate. */
function radicalInverse(index: number): number {
  let bits = index >>> 0;
  bits = ((bits << 16) | (bits >>> 16)) >>> 0;
  bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
  bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
  bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
  bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
  return bits * 2.3283064365386963e-10;
}
