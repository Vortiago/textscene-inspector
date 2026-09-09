/**
 * A StandardMaterial3D's texture slots as data: which slots exist, which of
 * them a given material fills and from where (an ExtResource path, an inline
 * procedural sub-resource), and the sampler/UV state the material asks of
 * whatever lands in them. No React and no loading — that is
 * `useMeshMaterialTextures.ts`.
 */

import type * as THREE from 'three';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { parseResourceReference } from '../../../resources/SubResourceResolver';
import { resolveProceduralTexture } from '../../../resources/textures/resolveProceduralTexture';
import { applyTextureState, type TextureState } from '../../../resources/textures/applyTextureState';
import { GODOT_TEXTURE_FILTER_DEFAULT } from '../../../resources/textures/godotTextureFilter';
import type { StandardMaterial3DScalars } from '../../../resources/materials/standardmaterial3d/types';
import { triplanarPlaneScale } from './triplanarScale';

/** Texture slots StandardMaterial3D exposes — checked in this order. */
export const TEXTURE_PROPERTIES = [
  'albedo_texture',
  'normal_texture',
  'roughness_texture',
  'metallic_texture',
  'emission_texture',
  'ao_texture',
  'heightmap_texture',
  'anisotropy_flowmap',
] as const;

export type TextureSlot = (typeof TEXTURE_PROPERTIES)[number];

/**
 * Walk the material's texture slots and resolve each `ExtResource("id")`
 * reference to the underlying path string. Returns `{ slot: path | undefined }`
 * so the caller can fan out to `useResource` for each.
 */
export function collectTextureRequests(
  materialSubResource: TscnInternalResource | undefined,
  externalResources: readonly TscnExternalResource[]
): Partial<Record<TextureSlot, string>> {
  if (!materialSubResource) return {};
  const out: Partial<Record<TextureSlot, string>> = {};
  const data = materialSubResource.data as Record<string, unknown>;
  for (const slot of TEXTURE_PROPERTIES) {
    const raw = data[slot];
    if (typeof raw !== 'string') continue;
    const parsed = parseResourceReference(raw);
    if (!parsed || parsed.type !== 'ExtResource') continue;
    const ext = externalResources.find((r) => r.id === parsed.id);
    if (ext?.path) {
      out[slot] = ext.path;
    }
  }
  return out;
}

export interface ProceduralTextureSlots {
  textures: Partial<Record<TextureSlot, THREE.Texture>>;
  /** Cache keys for the slots that resolved — exactly those, so a key is never
   *  pinned for a texture the cache does not hold. */
  keys: string[];
}

/**
 * Rasterise every material texture slot that references an inline procedural
 * texture (currently `SubResource(GradientTexture2D)`) into a THREE.Texture,
 * collecting the cache keys those same slots must pin. Slots carrying an
 * ExtResource image, a non-gradient SubResource, or nothing are omitted,
 * leaving the async `useResource` path to handle them.
 *
 * One walk yields both: a second walk deriving keys on its own is free to
 * disagree with this one about which references are procedural.
 */
export function resolveProceduralTextures(
  materialSubResource: TscnInternalResource | undefined,
  internalResources: readonly TscnInternalResource[]
): ProceduralTextureSlots {
  const out: ProceduralTextureSlots = { textures: {}, keys: [] };
  if (!materialSubResource) return out;
  const data = materialSubResource.data as Record<string, unknown>;
  for (const slot of TEXTURE_PROPERTIES) {
    const raw = data[slot];
    if (typeof raw !== 'string') continue;
    const resolved = resolveProceduralTexture(raw, internalResources);
    if (resolved) {
      out.textures[slot] = resolved.texture;
      out.keys.push(resolved.key);
    }
  }
  return out;
}

/**
 * Per-material texture state: the UV transform (`uv1_scale` / `uv1_offset`),
 * the sampler filter (`texture_filter`) and the wrapping (`texture_repeat`,
 * whose default is applied to the shared texture at load).
 *
 * A triplanar material tiles per WORLD unit, not across the mesh's 0..1 UVs.
 * For a PlaneMesh we reproduce that density by folding the plane's size into
 * the scale (repeat = size × uv1_scale) — otherwise a 12×3.5 hallway floor
 * stretched one texture copy and read "too big".
 */
export function materialTextureState(
  materialScalars: StandardMaterial3DScalars | null,
  meshResource: TscnInternalResource | undefined
): TextureState | null {
  if (!materialScalars) return null;
  const scale =
    materialScalars.triplanar && meshResource
      ? triplanarPlaneScale(meshResource, materialScalars.uv1Scale)
      : materialScalars.uv1Scale;
  // PARITY LIMITATION (uv1_offset + world-triplanar): three.js applies
  // `offset` in UV space, but Godot's world-triplanar offset is in world
  // units, so a non-zero offset would shift by a different amount here. No
  // shipped scene sets uv1_offset, so impact is currently zero.
  return {
    uv: { scale, offset: materialScalars.uv1Offset },
    // Only an AUTHORED filter is a divergence. The scalars parser fills in
    // Godot's default, and passing that would clone every texture whose
    // sampler state merely differs from it — a procedural GradientTexture2D
    // has no mipmaps, so it would clone and re-upload per material per slot
    // for a filter no material asked for.
    filter:
      materialScalars.textureFilter === GODOT_TEXTURE_FILTER_DEFAULT
        ? undefined
        : materialScalars.textureFilter,
    repeat: materialScalars.textureRepeat,
  };
}

/**
 * Clone the loaded texture (if any) with the material's own texture state
 * applied. Returns `undefined` when nothing is loaded yet, so the
 * `<meshStandardMaterial>` falls back to `null` for that slot.
 *
 * `applyTextureState` clones before mutating, so two MeshInstance3D nodes
 * sharing a texture path with different tiling or filtering don't clobber each
 * other, and hands the original straight back when this material asks for
 * neither.
 */
export function transformedTexture(
  texture: THREE.Texture | undefined,
  state: TextureState | null
): THREE.Texture | undefined {
  if (!texture) return undefined;
  if (!state) return texture;
  return applyTextureState(texture, state);
}
