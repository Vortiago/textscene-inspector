/**
 * Per-slot texture state — the UV transform, the sampler filter, the wrapping
 * and the COLOUR SPACE — applied by cloning only when the binding actually
 * diverges from the shared source.
 *
 * NOT A RESOURCE SLICE (ADR-0031): it decodes no Godot serialization and claims
 * no type name. It is the shared APPLIER over an already-loaded `THREE.Texture`,
 * which is why it sits beside the texture slices rather than inside one.
 *
 * INTERNAL SEAM. Nothing outside `standardmaterial3d/textureBinding.ts` calls
 * this in production. That module knows WHICH state a Godot texture slot
 * requires; this one knows only how to make a texture carry a state it is
 * handed. Keeping the two apart is what lets the rule live in one place while
 * the mechanics stay reusable by any future material type.
 *
 * WHY CLONE. `useResource` returns the SAME cached `THREE.Texture` for every
 * consumer of a path (the identity-equality contract). Everything this module
 * applies lives on the Texture rather than the Material in three, but is
 * per-MATERIAL (or per-SLOT) in Godot — two materials can legitimately sample
 * one image with different tiling or filtering, and one image can legitimately
 * be an albedo for one material and a roughness map for another. Mutating in
 * place would make whichever material built last silently win for all of them,
 * an order-dependent bug no test would catch.
 *
 * WHY ONE FUNCTION FOR ALL OF THEM. A texture can diverge for each reason
 * independently, and doing them in sequence would clone repeatedly for the same
 * material. Divergence is decided first, then a single clone carries whatever
 * applies.
 *
 * WHY MATERIAL-BUILD TIME rather than texture load. `createTextureFromBuffer`
 * receives bytes and a mime type; it has no idea which material or which slot is
 * asking, so neither the filter nor the colour space can be resolved there
 * without inverting the dependency.
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

/**
 * The half of a binding that comes from the MATERIAL and is the same for every
 * slot on it.
 */
export interface MaterialTextureState {
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

export interface TextureState extends MaterialTextureState {
  /**
   * The colour space this binding must sample in — REQUIRED, because a texture
   * arrives carrying whatever its producer happened to tag and only the binding
   * knows what the sampler needs. Declarative, not corrective: whatever the
   * texture says now, it leaves here saying this.
   */
  colorSpace: THREE.ColorSpace;
}

/**
 * Permanently pins `texture.colorSpace`, immune to `@react-three/fiber`'s OWN
 * automatic sRGB tagging: `applyProps` (`@react-three/fiber`'s `events-*.js`,
 * the `colorMaps.includes(key)` branch — `colorMaps = ['map', 'emissiveMap',
 * 'sheenColorMap', 'specularColorMap', 'envMap']`) force-rewrites ANY 8-bit
 * RGBA texture assigned to one of those JSX props back to `SRGBColorSpace`, on
 * every commit, whenever the R3F root is not in `linear` mode — which this
 * codebase's `<Canvas>`s are not (`rootState.linear` defaults `false`, never
 * overridden). That auto-tagging is invisible everywhere else in this codebase
 * because every OTHER texture already wants `SRGBColorSpace`; a deliberately
 * `NoColorSpace` `map` is the first thing here it fights. A plain assignment
 * loses that fight silently on the very next commit — this pins the getter so
 * the fight has no effect, rather than depending on REACT's effect ordering to
 * win it back after the fact.
 *
 * The pin matters even for props R3F's `colorMaps` list does NOT name
 * (`normalMap`, `roughnessMap`, …): the list is a dependency's internal detail,
 * and a plain assignment would silently start losing the moment it grows.
 */
export function pinNoColorSpace(texture: THREE.Texture): THREE.Texture {
  Object.defineProperty(texture, 'colorSpace', {
    get: () => THREE.NoColorSpace,
    set: () => {
      // Discard `@react-three/fiber`'s own reassignment attempt — see the
      // function doc comment above.
    },
    configurable: true,
    enumerable: true,
  });
  return texture;
}

/**
 * The texture this binding should sample: the original when it needs nothing of
 * its own, otherwise a clone carrying every divergence at once.
 */
export function applyTextureState(texture: THREE.Texture, state: TextureState): THREE.Texture {
  // A render target is excluded OUTRIGHT, whatever the binding asked for: its
  // texture is the live attachment of a `WebGLRenderTarget` (a ViewportTexture),
  // and a clone shares only the source — the material would sample a copy that
  // no longer follows the target, i.e. a frozen frame.
  //
  // That exclusion now covers COLOUR SPACE too, and deliberately so: a
  // SubViewport's target is written already tone-mapped and tagged
  // `LinearSRGBColorSpace` by the viewport that owns it, and re-tagging the
  // live attachment would change what every OTHER reader of that same target
  // sees. A ViewportTexture keeps the colour space its producer chose.
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
  // The producer's tag is only the ARRIVAL state; a texture whose tag already
  // matches what the sampler needs is shared untouched, exactly like every
  // other kind of state here.
  const colorSpaceDiverges = texture.colorSpace !== state.colorSpace;
  if (!uvDiverges && !filterDiverges && !wrapDiverges && !colorSpaceDiverges) return texture;

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
  // Pinned rather than assigned for the undecoded case: R3F reasserts
  // `SRGBColorSpace` on colour-map props every commit, so a plain write is
  // silently undone. The decoding case wants exactly what R3F would reassert,
  // so it needs no defence.
  if (state.colorSpace === THREE.NoColorSpace) pinNoColorSpace(cloned);
  else cloned.colorSpace = state.colorSpace;
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
