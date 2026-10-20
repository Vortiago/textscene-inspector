/**
 * Per-slot texture state (UV set and transform, filter, wrapping, colour space), applied
 * by cloning only when the binding diverges from the shared source. Not a
 * resource slice (ADR-0031): it decodes nothing. Each caller decides the state its
 * sampler needs.
 */

import * as THREE from 'three';
import {
  applyTextureFilterState,
  godotTextureFilterState,
  hasMipChain,
  textureFilterMatches,
} from './godotTextureFilter';
import { texelTexture, textureMipChain } from './texelTexture';
import { readImagePixels } from '../formats/image/imagePixels';
import type { MipLevel } from '../processing/mipChain';

/** Below this, a UV transform is indistinguishable from identity. */
const IDENTITY_EPSILON = 1e-6;

/** Marks a texture this module cloned, so its binder may dispose it. */
const BINDING_OWNED = 'textsceneClonedForBinding';

export interface UVTransform {
  scale: { x: number; y: number };
  offset: { x: number; y: number };
}

/**
 * The half of a binding that comes from the material, the same for every slot.
 * It applies at material build: `createTextureFromBuffer` knows no material or slot.
 */
export interface MaterialTextureState {
  /** The UV set's scale and offset. Omitted means no tiling transform. */
  uv?: UVTransform;
  /** three's UV channel the slot samples, `UV2_CHANNEL` for Godot's UV2. Omitted means UV1. */
  channel?: number;
  /** Godot `BaseMaterial3D.texture_filter` ordinal. Omitted means its default. */
  filter?: number;
  /**
   * Godot `BaseMaterial3D.texture_repeat`, default true
   * (`flags[FLAG_USE_TEXTURE_REPEAT] = true`, `repeat_enable` on the sampler).
   * three defaults to clamp-to-edge, which smears UVs outside 0..1 into stripes.
   * The loader leaves wrapping at that clamp default (ADR-0044), so this field is
   * the binding's only source of Repeat.
   * Omitted means Godot's default.
   */
  repeat?: boolean;
}

interface TextureState extends MaterialTextureState {
  /**
   * The sampler reads a mip chain, whatever the import gives, as Godot's decal atlas blits one
   * (`texture_storage.cpp:3169-3226`). The atlas halves each level in byte space, as an imported
   * chain does, so a texture with one is shared. Omitted means the import's chain.
   */
  buildsMipChain?: boolean;
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
  return pinColorSpace(texture, THREE.NoColorSpace);
}

/** Pins `texture.colorSpace` to `colorSpace`, discarding a later write, as `pinNoColorSpace` does. */
export function pinColorSpace(texture: THREE.Texture, colorSpace: THREE.ColorSpace): THREE.Texture {
  Object.defineProperty(texture, 'colorSpace', {
    get: () => colorSpace,
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
  // frame. Nor is it re-tagged: its pass reads the tag as its output space, and
  // its storage, not the tag, decides what a sample decodes.
  if (texture.isRenderTargetTexture) return texture;

  const filterState = godotTextureFilterState(state.filter);
  const uvDiverges = state.uv !== undefined && !isIdentity(state.uv);
  // A producer may hand over either wrapping (ADR-0044), so the wanted wrapping
  // is compared with what the texture carries. Only a texture already wrapped as
  // the binding wants stays shared.
  const wrapping = state.repeat === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  const wrapDiverges = texture.wrapS !== wrapping || texture.wrapT !== wrapping;
  // Only an authored filter diverges. Otherwise a GradientTexture2D, which has no
  // mipmaps, would clone per material and slot for a filter nobody asked for.
  const filterDiverges = state.filter !== undefined && !textureFilterMatches(texture, filterState);
  const mipChainDiverges = state.buildsMipChain === true && !hasMipChain(texture);
  // A texture whose tag already matches the sampler is shared untouched.
  const colorSpaceDiverges = texture.colorSpace !== state.colorSpace;
  const channel = state.channel ?? 0;
  const channelDiverges = texture.channel !== channel;
  const diverges =
    uvDiverges || filterDiverges || mipChainDiverges || wrapDiverges || colorSpaceDiverges || channelDiverges;
  if (!diverges) return texture;

  // One clone, however many reasons. `clone()` shares `source`, so the image
  // bytes are not duplicated unless the clone needs a chain of its own.
  const cloned = mipChainDiverges ? withAtlasMipChain(texture) : texture.clone();
  if (uvDiverges) {
    cloned.repeat.set(state.uv!.scale.x, state.uv!.scale.y);
    cloned.offset.set(state.uv!.offset.x, state.uv!.offset.y);
  }
  // Every clone carries the wanted wrapping and UV set, whatever the reason it was made.
  cloned.wrapS = wrapping;
  cloned.wrapT = wrapping;
  cloned.channel = channel;
  if (filterDiverges || mipChainDiverges) applyTextureFilterState(cloned, filterState);
  // Pinned, not assigned: R3F reasserts `SRGBColorSpace` every commit. The sRGB
  // case wants what R3F reasserts, so it needs no pin.
  if (state.colorSpace === THREE.NoColorSpace) pinNoColorSpace(cloned);
  else cloned.colorSpace = state.colorSpace;
  cloned.userData[BINDING_OWNED] = true;
  cloned.needsUpdate = true;
  return cloned;
}

/**
 * A copy of `texture` with the chain Godot's decal atlas blits: each level halves the one above in
 * its RGBA8 UNORM bytes (`texture_storage.cpp:3162-3226`), the same box `mipChain` averages. An
 * image whose RGBA8 bytes cannot be read gets a clone that asks the GPU for its chain.
 */
function withAtlasMipChain(texture: THREE.Texture): THREE.Texture {
  const levels = atlasMipChain(texture);
  if (!levels) {
    const cloned = texture.clone();
    cloned.generateMipmaps = true;
    return cloned;
  }
  return copyPlacement(texelTexture(texture, levels), texture);
}

/**
 * Written only by `atlasMipChain`. A decal rebuilds its projection on each colour, size or fade
 * change, so a source's chain is read back and halved once per source version, not per rebuild.
 */
const atlasMipChains = new WeakMap<THREE.Texture['source'], { version: number; levels: MipLevel[] }>();

/** The byte-space chain of `texture`'s pixels, or `undefined` when they cannot be read. */
function atlasMipChain(texture: THREE.Texture): MipLevel[] | undefined {
  const { source } = texture;
  const cached = atlasMipChains.get(source);
  if (cached?.version === source.version) return cached.levels;
  if (!readsAsBytes(texture)) return undefined;
  const pixels = readImagePixels(texture.image);
  if (!pixels) return undefined;
  const { data, width, height } = pixels;
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data.buffer, data.byteOffset, data.length);
  const levels = textureMipChain(texture, { data: bytes, width, height }, false);
  atlasMipChains.set(source, { version: source.version, levels });
  return levels;
}

/** Whether `readImagePixels` gives `texture` as RGBA8: its own bytes, or half floats it clamps to bytes. */
function readsAsBytes({ format, type }: THREE.Texture): boolean {
  return format === THREE.RGBAFormat && (type === THREE.UnsignedByteType || type === THREE.HalfFloatType);
}

/**
 * Writes what `Texture.copy` carries beyond the texels, sampling, tag and flip onto `target`, so a
 * rebuilt chain stands in for a clone of `source`. Returns `target`.
 */
function copyPlacement<T extends THREE.Texture>(target: T, source: THREE.Texture): T {
  target.name = source.name;
  target.offset.copy(source.offset);
  target.repeat.copy(source.repeat);
  target.center.copy(source.center);
  target.rotation = source.rotation;
  target.matrixAutoUpdate = source.matrixAutoUpdate;
  target.matrix.copy(source.matrix);
  target.premultiplyAlpha = source.premultiplyAlpha;
  target.userData = JSON.parse(JSON.stringify(source.userData)) as Record<string, unknown>;
  return target;
}

/**
 * Whether a texture is a clone `applyTextureState` made for its binder, not the loader's cache
 * entry, so that the binder disposes it.
 */
function isBindingOwnedTexture(texture: THREE.Texture): boolean {
  return texture.userData[BINDING_OWNED] === true;
}

/**
 * Release a texture `applyTextureState` returned: a dispose on a clone it made, and a no-op on a
 * shared cache entry, which the loader owns.
 */
export function releaseBoundTexture(texture: THREE.Texture | null | undefined): void {
  if (texture && isBindingOwnedTexture(texture)) texture.dispose();
}

function isIdentity(uv: UVTransform): boolean {
  return near(uv.scale.x, 1) && near(uv.scale.y, 1) && near(uv.offset.x, 0) && near(uv.offset.y, 0);
}

function near(value: number, target: number): boolean {
  return Math.abs(value - target) < IDENTITY_EPSILON;
}
