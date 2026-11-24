import * as THREE from 'three';
import { withMipLevels } from '../../r3f/mipLevels.js';
import {
  REAL_TIME_ROUGHNESS_LAYERS,
  SKY_ROUGHNESS_LAYERS_DEFAULT,
  skyOctmapLayout,
  type SkyOctmapLayout,
  type SkyRadianceLayout,
} from '../../godot/rendering/environment/skyReflection.js';
import { GODOT_SAMPLING, type ProjectSampling } from '../../shaders/uniforms/samplerState.js';
import type { SkyBake } from './types.js';

/** An octmap array holding only the mips `layout` names, so a read's lod stops at the last as in Godot. */
interface OctmapArray<Layout extends SkyOctmapLayout> {
  readonly layout: Layout;
  /** Written only by `swapSkyLayerTargets`, so each reader reads it at its read. */
  target: THREE.WebGLArrayRenderTarget;
}

/** A sky's roughness layers, layer 0 the radiance, an array layer each (`sky.cpp:1545-1576`). */
export type SkyLayers = OctmapArray<SkyRadianceLayout>;

/** Godot's reflection atlas: a layer per probe, a mip per roughness layer (`light_storage.cpp:1487`). */
export type ReflectionAtlas = OctmapArray<SkyOctmapLayout>;

/** The roughness layers of a sky baked with `radianceFilter`, seven when real-time (`sky.cpp:1547-1550`). */
export function roughnessLayersOf(radianceFilter: SkyBake['radianceFilter']): number {
  return radianceFilter === 'fast' ? REAL_TIME_ROUGHNESS_LAYERS : SKY_ROUGHNESS_LAYERS_DEFAULT;
}

/** The array of a sky baked as `bake`. */
function skyLayersLayout({ radianceFilter, radianceSize }: SkyBake): SkyRadianceLayout {
  return skyOctmapLayout(radianceSize, roughnessLayersOf(radianceFilter));
}

/** Godot's sky layers for `bake`, which nothing has drawn. The caller frees them with `disposeSkyLayers`. */
export function createSkyLayers(bake: SkyBake, sampling?: ProjectSampling): SkyLayers {
  const layout = skyLayersLayout(bake);
  return createOctmapArray(layout, layout.layerSizes.length, sampling);
}

/** Swaps the arrays of two sky layers of one layout, so `a` holds what `b` held and `b` what `a` held. */
export function swapSkyLayerTargets(a: SkyLayers, b: SkyLayers): void {
  [a.target, b.target] = [b.target, a.target];
}

export function disposeSkyLayers(layers: SkyLayers): void {
  layers.target.dispose();
}

/** An atlas of `probeCount` layers laid out as `layout`. The caller owns its target. */
export function createReflectionAtlas(layout: SkyOctmapLayout, probeCount: number): ReflectionAtlas {
  // A texture array needs a layer, so an atlas of no probes holds one nothing reads.
  return createOctmapArray(layout, Math.max(probeCount, 1));
}

/** `depth` layers of `layout`, read with the project's mip filter (`material_storage.cpp:2458`). */
function createOctmapArray<Layout extends SkyOctmapLayout>(
  layout: Layout,
  depth: number,
  sampling: ProjectSampling = GODOT_SAMPLING
): OctmapArray<Layout> {
  const minFilter = sampling.useNearestMipmapFilter
    ? THREE.LinearMipmapNearestFilter
    : THREE.LinearMipmapLinearFilter;
  const options = { ...MIPMAPPED_TARGET_OPTIONS, minFilter };
  const target = new THREE.WebGLArrayRenderTarget(layout.size, layout.size, depth, options);
  return { layout, target: withMipLevels(target, 1 + layout.downsampledSizes.length) };
}

// Linear and clamped as Godot's octmap samplers are (`copy_effects.cpp:1155`): an array defaults to nearest.
export const TARGET_OPTIONS: THREE.RenderTargetOptions = {
  type: THREE.HalfFloatType,
  depthBuffer: false,
  generateMipmaps: false,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
};

export const MIPMAPPED_TARGET_OPTIONS: THREE.RenderTargetOptions = {
  ...TARGET_OPTIONS,
  minFilter: THREE.LinearMipmapLinearFilter,
};
