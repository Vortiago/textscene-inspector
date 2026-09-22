/**
 * BINDING A TEXTURE TO A StandardMaterial3D SLOT — the one place that knows what
 * a Godot texture slot requires of the texture it samples.
 *
 * A material reaches the renderer by two adapters: `<StandardMaterialSlot>`
 * fed by the node component (reactive JSX) and `build.ts` (imperative THREE
 * construction). Both bind textures to slots, so both cross this seam. The
 * caller names the SLOT and hands over the material's own state; everything
 * else — which slots decode sRGB and which sample raw bytes, when a shared
 * cache entry must be cloned rather than mutated, that `@react-three/fiber`
 * re-asserts sRGB on colour-map props every commit, who owns the clone — is
 * behind it.
 *
 * WHICH SLOTS DECODE. Godot writes the answer into the shader
 * `BaseMaterial3D::_update_shader` generates: a sampler carrying the
 * `source_color` hint is bound to the texture's sRGB-typed GPU view and decoded
 * by the sampling hardware, and a sampler without it reads the stored bytes.
 * The chain is `source_color` on a sampler uniform → `uniform.use_color`
 * (`servers/rendering/shader_language.cpp:9830`) → `ShaderCompiler`'s
 * `texture.use_color` (`servers/rendering/shader_compiler.cpp:613`) → the srgb
 * texture view actually bound
 * (`servers/rendering/renderer_rd/storage_rd/material_storage.cpp:1067,1073`),
 * with `p_use_linear_color` true for every 3D material
 * (`servers/rendering/renderer_rd/forward_clustered/scene_shader_forward_clustered.cpp:595`).
 *
 * EXACTLY THREE of BaseMaterial3D's samplers carry it:
 *
 *   scene/resources/material.cpp:969   texture_albedo        : source_color
 *   scene/resources/material.cpp:1066  texture_emission      : source_color, hint_default_black
 *   scene/resources/material.cpp:1137  texture_detail_albedo : source_color
 *
 * Every other sampler in that file carries `hint_default_white`,
 * `hint_default_black`, `hint_roughness_*`, `hint_normal`, `hint_anisotropy` or
 * no hint at all, and is therefore read RAW:
 *
 *   :1024 texture_metallic          :1030 texture_roughness   :1053 texture_orm
 *   :1075 texture_refraction        :1092 texture_normal      :1099 texture_bent_normal
 *   :1107 texture_rim               :1115 texture_clearcoat   :1122 texture_flowmap
 *   :1128 texture_ambient_occlusion :1138 texture_detail_normal
 *   :1139 texture_detail_mask       :1147 texture_subsurface_scattering
 *   :1156 texture_subsurface_transmittance                    :1165 texture_backlight
 *   :1172 texture_heightmap
 *
 * The decision is a property of the SLOT, never of the image: the same file
 * bound to `albedo_texture` decodes and bound to `roughness_texture` does not.
 * That is why it belongs here, at the binding, and not at the loader — which
 * tags every decoded image `SRGBColorSpace` before any slot is known, an
 * arrival state this module overrides rather than trusts.
 *
 * Not a resource slice entry point: this module value-imports `three`, so
 * `index.ts` never reaches it (the linter-bundle rule, ADR-0031).
 */

import * as THREE from 'three';
import {
  applyTextureState,
  isMaterialOwnedTexture,
  type MaterialTextureState,
} from '../../textures/applyTextureState';
import { GODOT_TEXTURE_FILTER_DEFAULT } from '../../textures/godotTextureFilter';
import type { StandardMaterial3DScalars, TextureSlot } from './types';

/**
 * The colour space each slot's sampler reads in — the `source_color` table
 * above, transcribed. Exhaustive over `TextureSlot` by type, so a slot added
 * to the decode fails to compile until someone reads Godot's shader for it.
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

/**
 * The per-material half of a binding: the state every slot on this material
 * shares. Split out from the slot's own half so a caller that must adjust it —
 * a triplanar material folds the mesh size into the tiling scale — can do so
 * without touching the per-slot decision.
 *
 * Only an AUTHORED filter is passed: comparing an unauthored material against
 * Godot's default would clone every texture whose sampler state merely differs
 * from it, re-uploading per material per slot for a filter nobody asked for.
 */
export function materialTextureState(
  scalars: StandardMaterial3DScalars
): MaterialTextureState {
  return {
    uv: { scale: scalars.uv1Scale, offset: scalars.uv1Offset },
    filter:
      scalars.textureFilter === GODOT_TEXTURE_FILTER_DEFAULT ? undefined : scalars.textureFilter,
    repeat: scalars.textureRepeat,
  };
}

/**
 * The texture this slot must sample. The original when it already carries
 * everything the binding needs, otherwise a clone that does — cloned once for
 * however many reasons, and marked so `releaseBoundTexture` can free it.
 */
export function bindSlotTexture(
  texture: THREE.Texture,
  slot: TextureSlot,
  material: MaterialTextureState
): THREE.Texture {
  return applyTextureState(texture, { ...material, colorSpace: SLOT_COLOR_SPACE[slot] });
}

/**
 * Release a texture a binding produced. A no-op on a shared cache entry — the
 * loader owns those and another material may still be sampling one — and a
 * dispose on a clone this module made, which nothing else can reach.
 *
 * Symmetric with `bindSlotTexture` on purpose: a caller that binds learns one
 * more name to unbind, rather than learning how ownership is recorded.
 */
export function releaseBoundTexture(texture: THREE.Texture | null | undefined): void {
  if (texture && isMaterialOwnedTexture(texture)) texture.dispose();
}
