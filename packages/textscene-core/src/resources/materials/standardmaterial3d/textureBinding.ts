/**
 * Binding a texture to a StandardMaterial3D slot, the one place that knows what a Godot
 * slot needs of its texture: the sampler its view states (`textureView.ts`).
 * `useSurfaceMaterial` crosses it once, for `<StandardMaterialSlot>` and the GLB override. It
 * value-imports `three`, so `index.ts` never reaches it (ADR-0031).
 */

import * as THREE from 'three';
import type { ViewSampler } from '../../textures/textureView';
import { godotTextureFilterState, type TextureFilterState } from '../../textures/godotTextureFilter';
import type { UvWindow } from '../../../r3f/uvWindow';
import { BASE_MATERIAL_3D_DEFAULTS } from '../../../godot/scene/baseMaterial3D';
import { sourceColorSpace } from '../../textures/sourceColorSpace';
import { UV2_CHANNEL } from '../../meshes/uv2';
import { bottomUpV } from '../../../godot/math/uv';
import type { StandardMaterial3DScalars, TextureSlot } from './types';

/**
 * Whether each slot's sampler carries `source_color`, which reads a texture's sRGB view: albedo
 * (`scene/resources/material.cpp:969`), emission (:1066) and detail albedo (:1137). Every other
 * sampler reads raw. Exhaustive, so a new slot fails to compile until someone reads Godot's
 * shader. `textureBinding.md` has the shader chain and every sampler.
 */
const SLOT_READS_SOURCE_COLOR: Readonly<Record<TextureSlot, boolean>> = {
  albedo_texture: true,
  emission_texture: true,
  normal_texture: false,
  roughness_texture: false,
  metallic_texture: false,
  ao_texture: false,
  heightmap_texture: false,
  anisotropy_flowmap: false,
};

/**
 * The colour space `slot`'s sampler reads `texture` in. It overrides the producer's tag: sRGB only
 * for a `source_color` slot and a texture whose format has an sRGB view.
 */
export function slotColorSpace(slot: TextureSlot, texture: THREE.Texture): THREE.ColorSpace {
  return slotReadsSourceColor(slot) ? sourceColorSpace(texture) : THREE.NoColorSpace;
}

/** Whether `slot`'s sampler carries `source_color`, so it reads a texture's sRGB view. */
export function slotReadsSourceColor(slot: TextureSlot): boolean {
  return SLOT_READS_SOURCE_COLOR[slot];
}

/**
 * The half of a binding that comes from the material, the same for every slot. It applies where a
 * slot binds: `createTextureFromBuffer` knows no material or slot.
 */
export interface MaterialTextureState {
  /** three's UV channel the slot samples, `UV2_CHANNEL` for Godot's UV2. Omitted means UV1. */
  channel?: number;
  /** The authored `texture_filter` at the viewport's anisotropy level. Omitted when the material keeps the default. */
  filter?: TextureFilterState;
  /**
   * Both axes. Godot's `texture_repeat` is `repeat_enable` on the sampler, and three defaults to
   * clamp-to-edge, which smears UVs outside 0..1 into stripes. The loader leaves wrapping at that
   * clamp default (ADR-0044), so this field is the binding's only source of Repeat.
   */
  wrap: THREE.Wrapping;
}

/** The texture state of the slots that sample one UV set, whose window is always known. */
export type UVSetState = MaterialTextureState & { uv: UvWindow };

/**
 * The per-material half of every binding, one state per UV set, which a caller can adjust
 * apart from the per-slot decision, as a triplanar material folds the mesh size into the
 * tiling scale.
 */
export interface MaterialTextureStates {
  uv1: UVSetState;
  uv2: UVSetState;
  /** The slots that bind with `uv2`. */
  uv2Slots: readonly TextureSlot[];
}

/**
 * The texture states of a material's slots. Only an authored filter passes: comparing against
 * Godot's default would clone every texture whose sampler state differs from it.
 */
export function materialTextureStates(
  scalars: StandardMaterial3DScalars,
  anisotropicFilteringLevel: number
): MaterialTextureStates {
  const sampler = {
    filter:
      scalars.textureFilter === BASE_MATERIAL_3D_DEFAULTS.textureFilter
        ? undefined
        : godotTextureFilterState(scalars.textureFilter, anisotropicFilteringLevel),
    wrap: scalars.textureRepeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping,
  };
  const uv2 = { ...sampler, uv: { repeat: scalars.uv2Scale, offset: scalars.uv2Offset } };
  return {
    uv1: { ...sampler, uv: { repeat: scalars.uv1Scale, offset: scalars.uv1Offset } },
    // A triplanar mapping reads no UV2. three draws it through the first UV set, as for UV1.
    // Every UV2 attribute keeps Godot's top-down V, so a mesh without one samples the top-left.
    uv2: scalars.uv2Triplanar ? uv2 : topDownV({ ...uv2, channel: UV2_CHANNEL }),
    uv2Slots: scalars.uv2Slots,
  };
}

/** A state that samples `1 - (v * scale + offset)`, Godot's top-down V on a bottom-up upload. */
export function topDownV(state: UVSetState): UVSetState {
  const { repeat, offset } = state.uv;
  return {
    ...state,
    uv: { repeat: { x: repeat.x, y: -repeat.y }, offset: { x: offset.x, y: bottomUpV(offset.y) } },
  };
}

/** What `slot` samples of `texture`: the sampler and window of the slot's UV set, in the slot's colour space. */
export function slotViewSampler(
  texture: THREE.Texture,
  slot: TextureSlot,
  states: MaterialTextureStates
): ViewSampler {
  const { filter, wrap, uv, channel } = states.uv2Slots.includes(slot) ? states.uv2 : states.uv1;
  return { colorSpace: slotColorSpace(slot, texture), filter, wrap, window: uv, channel };
}
