/** GGX importance sampling of a sky's or a reflection atlas's layers (`octmap_roughness.glsl:62-84`), Godot's default filter. */

import { layerSamples, type SkyOctmapLayout } from '../../godot/rendering/environment/skyReflection.js';
import { LAYER_FILTER_UNIFORMS, type LayerFilter } from './layerFilter.js';
import { IMPORTANCE_SAMPLE_FRAGMENT_SHADER } from './skyLayerShaders.js';
import { skyPass } from './skyPass.js';
import { perRenderer } from '../../r3f/perRenderer.js';

/** One pass per renderer for every layout, as each filter would otherwise compile it again. */
const importanceSamplePassFor = perRenderer(() =>
  skyPass(IMPORTANCE_SAMPLE_FRAGMENT_SHADER, [...LAYER_FILTER_UNIFORMS, 'samples', 'sampleCount'])
);

/** Written only by `importanceSampleFilter`, on the first bake of a layout. */
const filtersByLayout = new Map<string, LayerFilter>();

/** The filter for layers laid out as `layout`: a sky's, or a reflection atlas's. Made once per layout. */
export function importanceSampleFilter(layout: SkyOctmapLayout): LayerFilter {
  const key = JSON.stringify(layout);
  let filter = filtersByLayout.get(key);
  if (filter) return filter;
  const lastLayer = layout.layerSizes.length - 1;
  const uniformsByLayer = layout.layerSizes.map((_, layer) => {
    const samples = packedSamples(layout, layer);
    return { samples, sampleCount: samples.length / 4 };
  });
  filter = {
    chainSizes: layout.downsampledSizes,
    passFor: importanceSamplePassFor,
    layerUniforms(layer) {
      const uniforms = uniformsByLayer[layer];
      if (!uniforms) throw new Error(`expected a layer from 0 to ${lastLayer}, got ${layer}`);
      return uniforms;
    },
  };
  filtersByLayout.set(key, filter);
  return filter;
}

/** Layer `layer`'s samples as the shader reads them: each direction, then the mip it reads. */
function packedSamples(layout: SkyOctmapLayout, layer: number): Float32Array {
  return Float32Array.from(layerSamples(layout, layer).flatMap(({ direction, lod }) => [...direction, lod]));
}
