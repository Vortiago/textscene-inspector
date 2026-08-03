/**
 * Per-material texture state — the UV transform and the sampler filter — applied
 * by cloning only when the material actually diverges from the shared source.
 *
 * NOT A RESOURCE SLICE (ADR-0031): it decodes no Godot serialization and claims
 * no type name. It is a SHARED APPLIER over an already-loaded `THREE.Texture`,
 * consumed by every material slice's renderer — which is why it sits beside the
 * texture slices rather than inside one.
 *
 * WHY CLONE. `useResource` returns the SAME cached `THREE.Texture` for every
 * consumer of a path (the identity-equality contract). Both things this module
 * applies live on the Texture rather than the Material in three, but are
 * per-MATERIAL in Godot — two materials can legitimately sample one image with
 * different tiling or different filtering. Mutating in place would make
 * whichever material built last silently win for all of them, an
 * order-dependent bug no test would catch.
 *
 * WHY ONE FUNCTION FOR BOTH. A texture can diverge for either reason
 * independently, and doing them in sequence would clone twice for the same
 * material. Divergence is decided first, then a single clone carries whatever
 * applies.
 *
 * WHY MATERIAL-BUILD TIME rather than texture load. `createTextureFromBuffer`
 * receives bytes and a mime type; it has no idea which material is asking, so
 * the filter cannot be resolved there without inverting the dependency.
 *
 * This replaces two near-identical `applyUVTransform` implementations (one per
 * material path). Their semantics differed slightly and this is the merged
 * contract: an identity UV transform is a pass-through (the external-material
 * path used to clone whenever `uv1_scale` was merely PRESENT, even at identity),
 * and `offset` is honoured wherever the caller supplies it (the external path
 * does not parse `uv1_offset` yet, so it passes zero).
 */

import * as THREE from 'three';
import {
  applyTextureFilterState,
  godotTextureFilterState,
  textureFilterMatches,
} from './godotTextureFilter';

/** Below this, a UV transform is indistinguishable from identity. */
const IDENTITY_EPSILON = 1e-6;

/** Marks a texture this module cloned, so its owning material may dispose it. */
const MATERIAL_OWNED = 'textsceneClonedForMaterial';

export interface UVTransform {
  scale: { x: number; y: number };
  offset: { x: number; y: number };
}

export interface TextureState {
  /** Godot `uv1_scale` / `uv1_offset`. Omitted means no tiling transform. */
  uv?: UVTransform;
  /** Godot `BaseMaterial3D.texture_filter` ordinal. Omitted means its default. */
  filter?: number;
  /**
   * Godot `BaseMaterial3D.texture_repeat`, whose default is TRUE
   * (`flags[FLAG_USE_TEXTURE_REPEAT] = true`, mapping to `repeat_enable` on the
   * sampler). three's `Texture` defaults to clamp-to-edge instead, so a surface
   * whose UVs leave 0..1 — a large terrain, a tiled road — smears its edge texel
   * into stripes rather than tiling. Omitted means Godot's default.
   */
  repeat?: boolean;
}

/**
 * The texture this material should sample: the original when it needs nothing
 * of its own, otherwise a clone carrying every divergence at once.
 */
export function applyTextureState(texture: THREE.Texture, state: TextureState): THREE.Texture {
  // A render target is excluded OUTRIGHT, whatever the material asked for: its
  // texture is the live attachment of a `WebGLRenderTarget` (a ViewportTexture),
  // and a clone shares only the source — the material would sample a copy that
  // no longer follows the target, i.e. a frozen frame.
  if (texture.isRenderTargetTexture) return texture;

  const filterState = godotTextureFilterState(state.filter);
  const uvDiverges = state.uv !== undefined && !isIdentity(state.uv);
  // Godot's default (repeat) is applied to the shared texture at load, so only
  // a material that explicitly turns it OFF diverges — the same rule the filter
  // follows, and what keeps every ordinary texture shared rather than cloned.
  const wrapping = state.repeat === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  const wrapDiverges =
    state.repeat === false && (texture.wrapS !== wrapping || texture.wrapT !== wrapping);
  // Only an AUTHORED filter can diverge. Comparing an unauthored material
  // against Godot's default would clone every texture whose sampler state
  // happens not to match it — a procedural GradientTexture2D has no mipmaps, so
  // it would clone and re-upload per material per slot for a filter no material
  // asked for.
  const filterDiverges =
    state.filter !== undefined && !textureFilterMatches(texture, filterState);
  if (!uvDiverges && !filterDiverges && !wrapDiverges) return texture;

  // ONE clone, however many reasons there were. `clone()` copies parameters and
  // shares `source`, so the image bytes are not duplicated.
  const cloned = texture.clone();
  if (uvDiverges) {
    cloned.repeat.set(state.uv!.scale.x, state.uv!.scale.y);
    cloned.offset.set(state.uv!.offset.x, state.uv!.offset.y);
  }
  // A tiling transform only tiles under repeat wrapping, so a clone made for
  // one carries it too — unless the material explicitly turned repeat off.
  if (wrapDiverges || uvDiverges) {
    cloned.wrapS = wrapping;
    cloned.wrapT = wrapping;
  }
  if (filterDiverges) applyTextureFilterState(cloned, filterState);
  cloned.userData[MATERIAL_OWNED] = true;
  cloned.needsUpdate = true;
  return cloned;
}

/**
 * Whether a texture belongs to the material holding it rather than to the
 * loader's cache — i.e. whether disposing the material should dispose it too.
 */
export function isMaterialOwnedTexture(texture: THREE.Texture): boolean {
  return texture.userData[MATERIAL_OWNED] === true;
}

function isIdentity(uv: UVTransform): boolean {
  return (
    near(uv.scale.x, 1) && near(uv.scale.y, 1) && near(uv.offset.x, 0) && near(uv.offset.y, 0)
  );
}

function near(value: number, target: number): boolean {
  return Math.abs(value - target) < IDENTITY_EPSILON;
}
