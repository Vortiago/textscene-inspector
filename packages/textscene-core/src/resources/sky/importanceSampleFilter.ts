/** GGX importance sampling of a sky's layers (`octmap_roughness.glsl:62-84`), Godot's default filter. */

import { layerSamples, skyOctmapLayout, type SkyOctmapLayout } from '../../godot/skyReflection.js';
import { LAYER_FILTER_UNIFORMS, type LayerFilter } from './layerFilter.js';
import { IMPORTANCE_SAMPLE_FRAGMENT_SHADER } from './skyLayerShaders.js';
import { setUniforms, skyPass } from './skyPass.js';

interface PackedSamples {
  /** Each sample's direction, then the mip it reads. */
  readonly samples: Float32Array;
  readonly count: number;
}

/** One pass for every radiance size, as each filter would otherwise compile it again. */
const importanceSamplePass = skyPass(IMPORTANCE_SAMPLE_FRAGMENT_SHADER, [
  ...LAYER_FILTER_UNIFORMS,
  'samples',
  'sampleCount',
]);

/** Written only by `importanceSampleFilter`, on the first sky of a radiance size. */
const filtersBySize = new Map<number, LayerFilter>();

/** The filter for a sky whose radiance is `radianceSize` wide, made once per size. */
export function importanceSampleFilter(radianceSize: number): LayerFilter {
  let filter = filtersBySize.get(radianceSize);
  if (filter) return filter;
  const layout = skyOctmapLayout(radianceSize);
  /** Written only by `selectLayer`, the first time a layer bakes. They hold for every sky of the size. */
  const samplesByLayer = new Map<number, PackedSamples>();
  filter = {
    layout,
    chainSizes: layout.downsampledSizes,
    pass: importanceSamplePass,
    selectLayer(layer) {
      let packed = samplesByLayer.get(layer);
      if (!packed) {
        packed = packedSamples(layout, layer);
        samplesByLayer.set(layer, packed);
      }
      setUniforms(importanceSamplePass, { samples: packed.samples, sampleCount: packed.count });
    },
  };
  filtersBySize.set(radianceSize, filter);
  return filter;
}

function packedSamples(layout: SkyOctmapLayout, layer: number): PackedSamples {
  const objects = layerSamples(layout, layer);
  const samples = new Float32Array(objects.length * 4);
  objects.forEach(({ direction, lod }, index) => samples.set([...direction, lod], index * 4));
  return { samples, count: objects.length };
}
