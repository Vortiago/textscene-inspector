/**
 * Binding a texture to a StandardMaterial3D slot, the one place that knows what a Godot
 * slot needs of its texture: its colour space, and when a shared cache entry must clone.
 * `SurfaceMaterialSlot` crosses it, for `<StandardMaterialSlot>` and the GLB override. It
 * value-imports `three`, so `index.ts` never reaches it (ADR-0031).
 */

import * as THREE from 'three';
import {
  applyTextureState,
  type MaterialTextureState,
  type UVTransform,
} from '../../textures/applyTextureState';
import { GODOT_TEXTURE_FILTER_DEFAULT } from '../../textures/godotTextureFilter';
import { UV2_CHANNEL } from '../../meshes/uv2';
import { bottomUpV } from '../../../godot/math/uv';
import type { StandardMaterial3DScalars, TextureSlot } from './types';

/**
 * The colour space each slot's sampler reads in: a property of the slot, never the image, so it
 * overrides the loader's tag. Only `source_color` samplers read sRGB: albedo (`scene/resources/material.cpp:969`),
 * emission (:1066) and detail albedo (:1137). Exhaustive, so a new slot fails to compile until someone
 * reads Godot's shader. `textureBinding.md` has the shader chain and every sampler.
 */
const SLOT_COLOR_SPACE: Readonly<Record<TextureSlot, THREE.ColorSpace>> = {
  albedo_texture: THREE.SRGBColorSpace,
  emission_texture: THREE.SRGBColorSpace,
  normal_texture: THREE.NoColorSpace,
  roughness_texture: THREE.NoColorSpace,
  metallic_texture: THREE.NoColorSpace,
  ao_texture: THREE.NoColorSpace,
  heightmap_texture: THREE.NoColorSpace,
  anisotropy_flowmap: THREE.NoColorSpace,
};

/** The colour space `slot`'s sampler reads in, whatever texture it binds. */
export function slotColorSpace(slot: TextureSlot): THREE.ColorSpace {
  return SLOT_COLOR_SPACE[slot];
}

/** The texture state of the slots that sample one UV set, whose transform is always known. */
export type UVSetState = MaterialTextureState & { uv: UVTransform };

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
export function materialTextureStates(scalars: StandardMaterial3DScalars): MaterialTextureStates {
  const sampler = {
    filter: scalars.textureFilter === GODOT_TEXTURE_FILTER_DEFAULT ? undefined : scalars.textureFilter,
    repeat: scalars.textureRepeat,
  };
  const uv2 = { ...sampler, uv: { scale: scalars.uv2Scale, offset: scalars.uv2Offset } };
  return {
    uv1: { ...sampler, uv: { scale: scalars.uv1Scale, offset: scalars.uv1Offset } },
    // A triplanar mapping reads no UV2. three draws it through the first UV set, as for UV1.
    // Every UV2 attribute keeps Godot's top-down V, so a mesh without one samples the top-left.
    uv2: scalars.uv2Triplanar ? uv2 : topDownV({ ...uv2, channel: UV2_CHANNEL }),
    uv2Slots: scalars.uv2Slots,
  };
}

/** A state that samples `1 - (v * scale + offset)`, Godot's top-down V on a bottom-up upload. */
export function topDownV(state: UVSetState): UVSetState {
  const { scale, offset } = state.uv;
  return {
    ...state,
    uv: { scale: { x: scale.x, y: -scale.y }, offset: { x: offset.x, y: bottomUpV(offset.y) } },
  };
}

/**
 * The texture this slot must sample: the original when it carries everything the
 * binding needs, otherwise one clone that does, marked so `releaseBoundTexture` frees it.
 */
export function bindSlotTexture(
  texture: THREE.Texture,
  slot: TextureSlot,
  states: MaterialTextureStates
): THREE.Texture {
  const material = states.uv2Slots.includes(slot) ? states.uv2 : states.uv1;
  return applyTextureState(texture, { ...material, colorSpace: slotColorSpace(slot) });
}
