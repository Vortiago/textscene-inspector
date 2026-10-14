/**
 * Godot's GGX importance-sampled filter, which bakes the layers of every sky but a real-time one: the
 * cosine-weighted mean of the half-size chain around each direction (`octmap_roughness.glsl`).
 */

import { vec3ToOctWithBorder, type OctDirection } from '../../godot/octmap.js';
import { layerSamples, skyOctmapLayout, type SkyOctmapLayout } from '../../godot/skyReflection.js';
import { frameAround } from './frame.js';
import type { LayerFilter } from './layerFilter.js';
import { addTrilinear, type Octmap } from './octmapImage.js';

const { abs } = Math;

const UP_Y: OctDirection = [0, 1, 0];
const UP_Z: OctDirection = [0, 0, 1];

/** Each sample's x, y and z in the texel's frame, then the mip it reads. */
const SAMPLE_STRIDE = 4;

/** Scratch, written only by `texel`: the frame's axes, and the UV of the sample it reads next. */
const tangent = new Float64Array(3);
const bitangent = new Float64Array(3);
const sampleUv = new Float64Array(2);

/** Written only by `importanceSampleFilter`, on the first sky of a radiance size. */
const filtersBySize = new Map<number, ImportanceSampleFilter>();

/** The filter for a sky whose radiance is `radianceSize` wide, made once per size. */
export function importanceSampleFilter(radianceSize: number): LayerFilter {
  let filter = filtersBySize.get(radianceSize);
  if (!filter) {
    filter = new ImportanceSampleFilter(skyOctmapLayout(radianceSize));
    filtersBySize.set(radianceSize, filter);
  }
  return filter;
}

class ImportanceSampleFilter implements LayerFilter {
  /** Written only by `samplesOf`, the first time a layer bakes. They hold for every sky of the size. */
  private readonly samplesByLayer = new Map<number, Float64Array>();

  constructor(readonly layout: SkyOctmapLayout) {}

  get chainSizes(): readonly number[] {
    return this.layout.downsampledSizes;
  }

  /**
   * The layer's samples turned into the frame Godot builds around `normal`, read from the mips and
   * weighed by their cosine (`octmap_roughness.glsl:62-84`).
   */
  texel(normal: OctDirection, mips: readonly Octmap[], layer: number, out: Float32Array): void {
    frameAround(abs(normal[1]) < 0.99999 ? UP_Y : UP_Z, normal, tangent, bitangent);
    const samples = this.samplesOf(layer);
    const { padding } = this.layout;
    out.fill(0);
    let total = 0;
    for (let at = 0; at < samples.length; at += SAMPLE_STRIDE) {
      const x = samples[at]!;
      const y = samples[at + 1]!;
      const z = samples[at + 2]!;
      vec3ToOctWithBorder(
        tangent[0]! * x + bitangent[0]! * y + normal[0] * z,
        tangent[1]! * x + bitangent[1]! * y + normal[1] * z,
        tangent[2]! * x + bitangent[2]! * y + normal[2] * z,
        padding,
        sampleUv
      );
      addTrilinear(mips, sampleUv[0]!, sampleUv[1]!, samples[at + 3]!, z, out);
      total += z;
    }
    for (let channel = 0; channel < 3; channel += 1) out[channel] = out[channel]! / total;
  }

  /** A flat array, not `LayerSample` objects: the bake reads it about 20 million times. */
  private samplesOf(layer: number): Float64Array {
    let samples = this.samplesByLayer.get(layer);
    if (samples) return samples;
    const objects = layerSamples(this.layout, layer);
    samples = new Float64Array(objects.length * SAMPLE_STRIDE);
    objects.forEach(({ direction, lod }, index) => samples!.set([...direction, lod], index * SAMPLE_STRIDE));
    this.samplesByLayer.set(layer, samples);
    return samples;
  }
}
