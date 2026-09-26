/**
 * Per-slot texture state (UV transform, filter, wrapping, colour space), applied
 * by cloning only when the binding diverges from the shared source. Not a
 * resource slice (ADR-0031): it decodes nothing. In production only
 * `standardmaterial3d/textureBinding.ts` and the panorama sky (`sky/build.ts`)
 * call it, and each decides the state its sampler needs.
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
 * The half of a binding that comes from the material, the same for every slot.
 * It applies at material build: `createTextureFromBuffer` knows no material or slot.
 */
export interface MaterialTextureState {
  /** Godot `uv1_scale` / `uv1_offset`. Omitted means no tiling transform. */
  uv?: UVTransform;
  /** Godot `BaseMaterial3D.texture_filter` ordinal. Omitted means its default. */
  filter?: number;
  /**
   * Godot `BaseMaterial3D.texture_repeat`, default true
   * (`flags[FLAG_USE_TEXTURE_REPEAT] = true`, `repeat_enable` on the sampler).
   * three defaults to clamp-to-edge, which smears UVs outside 0..1 into stripes.
   * The loader leaves wrapping at that clamp default (ADR-0042), so this field is
   * the binding's only source of Repeat.
   * Omitted means Godot's default.
   */
  repeat?: boolean;
}

export interface TextureState extends MaterialTextureState {
  /**
   * The colour space this binding samples in. Required: only the binding knows
   * what the sampler needs, whatever the producer tagged.
   */
  colorSpace: THREE.ColorSpace;
}

/**
 * Pins `texture.colorSpace` to `NoColorSpace`. `@react-three/fiber`'s `applyProps`
 * (`events-*.js`, the `colorMaps.includes(key)` branch over `['map', 'emissiveMap',
 * 'sheenColorMap', 'specularColorMap', 'envMap']`) rewrites an 8-bit texture there
 * to `SRGBColorSpace` every commit outside `linear` mode, which no `<Canvas>` sets.
 */
export function pinNoColorSpace(texture: THREE.Texture): THREE.Texture {
  Object.defineProperty(texture, 'colorSpace', {
    get: () => THREE.NoColorSpace,
    set: () => {
      // Discards `@react-three/fiber`'s reassignment. A pin, not a write after the
      // commit, so no effect order can undo it. It covers props the `colorMaps`
      // list does not name too, since that list can grow.
    },
    configurable: true,
    enumerable: true,
  });
  return texture;
}

/**
 * The texture this binding should sample: the original when it needs nothing,
 * else one clone carrying every divergence. `useResource` shares one cached
 * texture per path, while Godot keeps this state per material and slot, so a
 * mutation would let the last material built win for all.
 */
export function applyTextureState(texture: THREE.Texture, state: TextureState): THREE.Texture {
  // A render target (a ViewportTexture) is never cloned: a clone is a frozen
  // frame. Nor is it re-tagged: its SubViewport writes it tone-mapped as
  // `LinearSRGBColorSpace`, and every other reader shares that attachment.
  if (texture.isRenderTargetTexture) return texture;

  const filterState = godotTextureFilterState(state.filter);
  const uvDiverges = state.uv !== undefined && !isIdentity(state.uv);
  // A producer may hand over either wrapping (ADR-0042), so the wanted wrapping
  // is compared with what the texture carries. Only a texture already wrapped as
  // the binding wants stays shared.
  const wrapping = state.repeat === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  const wrapDiverges = texture.wrapS !== wrapping || texture.wrapT !== wrapping;
  // Only an authored filter diverges. Otherwise a GradientTexture2D, which has no
  // mipmaps, would clone per material and slot for a filter nobody asked for.
  const filterDiverges =
    state.filter !== undefined && !textureFilterMatches(texture, filterState);
  // A texture whose tag already matches the sampler is shared untouched.
  const colorSpaceDiverges = texture.colorSpace !== state.colorSpace;
  if (!uvDiverges && !filterDiverges && !wrapDiverges && !colorSpaceDiverges) return texture;

  // One clone, however many reasons. `clone()` shares `source`, so the image
  // bytes are not duplicated.
  const cloned = texture.clone();
  if (uvDiverges) {
    cloned.repeat.set(state.uv!.scale.x, state.uv!.scale.y);
    cloned.offset.set(state.uv!.offset.x, state.uv!.offset.y);
  }
  // Every clone carries the wanted wrapping, whatever the reason it was made.
  cloned.wrapS = wrapping;
  cloned.wrapT = wrapping;
  if (filterDiverges) applyTextureFilterState(cloned, filterState);
  // Pinned, not assigned: R3F reasserts `SRGBColorSpace` every commit. The sRGB
  // case wants what R3F reasserts, so it needs no pin.
  if (state.colorSpace === THREE.NoColorSpace) pinNoColorSpace(cloned);
  else cloned.colorSpace = state.colorSpace;
  cloned.userData[MATERIAL_OWNED] = true;
  cloned.needsUpdate = true;
  return cloned;
}

/**
 * Whether a texture belongs to the material holding it, not the loader's cache,
 * so that disposing the material disposes it too.
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
