/**
 * Godot's GGX importance-sampled filter, which bakes the rough layers of every sky but a real-time
 * one: the cosine-weighted mean of the half-size chain around each direction (`octmap_roughness.glsl`).
 */

import { vec3ToOctWithBorder, type OctDirection } from '../../godot/octmap.js';
import {
  SKY_RADIANCE_SIZE_DEFAULT,
  layerSamples,
  skyOctmapLayout,
  type LayerSample,
} from '../../godot/skyReflection.js';
import { cross, normalize } from './direction.js';
import type { LayerFilter } from './layerFilter.js';
import { addTrilinear, type Octmap } from './octmapImage.js';

const { abs } = Math;

/**
 * Godot's layout depends on `Sky.radiance_size` only through the chain's length, as the last mip
 * is 10 texels wide at every size. So the default size stands for every size.
 */
const LAYOUT = skyOctmapLayout(SKY_RADIANCE_SIZE_DEFAULT);

/** Written only by `samplesOf`, the first time a layer bakes. They hold for every sky. */
const samplesByLayer = new Map<number, LayerSample[]>();

/** The UV of one sample. Written only by `texel`, for the sample it reads next. */
const sampleUv = new Float64Array(2);

export const importanceSampleFilter: LayerFilter = {
  layout: LAYOUT,
  chainSizes: LAYOUT.downsampledSizes,
  texel,
};

function samplesOf(layer: number): LayerSample[] {
  let samples = samplesByLayer.get(layer);
  if (!samples) {
    samples = layerSamples(LAYOUT, layer);
    samplesByLayer.set(layer, samples);
  }
  return samples;
}

/**
 * The layer's samples turned into the frame Godot builds around `normal`, read from the mips and
 * weighed by their cosine (`octmap_roughness.glsl:62-84`).
 */
function texel(normal: OctDirection, mips: readonly Octmap[], layer: number, out: Float32Array): void {
  const up: OctDirection = abs(normal[1]) < 0.99999 ? [0, 1, 0] : [0, 0, 1];
  const tangent = normalize(cross(up, normal));
  const bitangent = cross(normal, tangent);
  out.fill(0);
  let total = 0;
  for (const {
    direction: [x, y, z],
    lod,
  } of samplesOf(layer)) {
    vec3ToOctWithBorder(
      tangent[0] * x + bitangent[0] * y + normal[0] * z,
      tangent[1] * x + bitangent[1] * y + normal[1] * z,
      tangent[2] * x + bitangent[2] * y + normal[2] * z,
      LAYOUT.padding,
      sampleUv
    );
    addTrilinear(mips, sampleUv[0]!, sampleUv[1]!, lod, z, out);
    total += z;
  }
  for (let channel = 0; channel < 3; channel += 1) out[channel] = out[channel]! / total;
}
