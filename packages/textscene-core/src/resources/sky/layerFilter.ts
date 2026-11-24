import {
  FAST_FILTER_CHAIN_SIZES,
  type FastFilterQuality,
  type SkyOctmapLayout,
} from '../../godot/rendering/environment/skyReflection.js';

/** GGX importance sampling (`octmap_roughness.glsl`), drawn a layer at a time (`sky.cpp:424-478`). */
export interface ImportanceSampleFilter {
  readonly kind: 'importance-sample';
  /** The width of each mip of the chain it reads, downsampled from the radiance. */
  readonly chainSizes: readonly number[];
}

/** The fast filter (`octmap_filter.glsl`), one dispatch of every layer but the first (`sky.cpp:374-422`). */
export interface FastFilter {
  readonly kind: 'fast';
  readonly chainSizes: readonly number[];
  readonly quality: FastFilterQuality;
  /** Godot's texture array path into a sky's layers, or the path into a probe's mips. */
  readonly isTextureArray: boolean;
}

export type LayerFilter = ImportanceSampleFilter | FastFilter;

/** The importance-sampling filter of layers laid out as `layout`: a sky's, or a reflection atlas's. */
export const importanceSampleFilter = (layout: SkyOctmapLayout): ImportanceSampleFilter => ({
  kind: 'importance-sample',
  chainSizes: layout.downsampledSizes,
});

/** Godot's fast filter into a sky's layers and into a probe's mips. */
export interface FastFilters {
  /** Into a sky's layers of one width, Godot's texture array path: `sky.cpp:1336`. */
  readonly intoLayers: FastFilter;
  /** Into the mips of a probe's layer, Godot's path without arrays: `light_storage.cpp:1655`. */
  readonly intoMips: FastFilter;
}

const fastFiltersOf = (quality: FastFilterQuality): FastFilters => ({
  intoLayers: { kind: 'fast', chainSizes: FAST_FILTER_CHAIN_SIZES, quality, isTextureArray: true },
  intoMips: { kind: 'fast', chainSizes: FAST_FILTER_CHAIN_SIZES, quality, isTextureArray: false },
});

/** The fast filters of each `fast_filter_high_quality` setting: `copy_effects.cpp:196-204`. */
export const FAST_FILTERS: Readonly<Record<FastFilterQuality, FastFilters>> = {
  low: fastFiltersOf('low'),
  high: fastFiltersOf('high'),
};
