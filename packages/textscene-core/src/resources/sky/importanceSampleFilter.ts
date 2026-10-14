/** GGX importance sampling of a sky's layers (`octmap_roughness.glsl:62-84`), Godot's default filter. */

import {
  SKY_ROUGHNESS_LAYERS_DEFAULT,
  layerSamples,
  skyOctmapLayout,
  type SkyOctmapLayout,
} from '../../godot/skyReflection.js';
import { LAYER_FILTER_UNIFORMS, type LayerFilter } from './layerFilter.js';
import { IMPORTANCE_SAMPLE_FRAGMENT_SHADER } from './skyLayerShaders.js';
import { setUniforms, skyPass } from './skyPass.js';

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
  const samplesByLayer = Array.from({ length: SKY_ROUGHNESS_LAYERS_DEFAULT }, (_, layer) =>
    packedSamples(layout, layer)
  );
  filter = {
    layout,
    chainSizes: layout.downsampledSizes,
    pass: importanceSamplePass,
    selectLayer(layer) {
      const samples = samplesByLayer[layer];
      if (!samples)
        throw new Error(`expected a layer from 0 to ${SKY_ROUGHNESS_LAYERS_DEFAULT - 1}, got ${layer}`);
      setUniforms(importanceSamplePass, { samples, sampleCount: samples.length / 4 });
    },
  };
  filtersBySize.set(radianceSize, filter);
  return filter;
}

/** Layer `layer`'s samples as the shader reads them: each direction, then the mip it reads. */
function packedSamples(layout: SkyOctmapLayout, layer: number): Float32Array {
  return Float32Array.from(layerSamples(layout, layer).flatMap(({ direction, lod }) => [...direction, lod]));
}
