/**
 * Godot's Nearest with Mipmaps and Anisotropic filter samples a nearest mip chain with anisotropy
 * (`material_storage.cpp:2490-2506`). three writes `TEXTURE_MAX_ANISOTROPY_EXT` only under a linear
 * magnification filter (r187 `WebGLTextures.js:756`), so this writes it onto the GPU texture itself.
 */
import { useContext, useEffect } from 'react';
import * as THREE from 'three';
import { context } from '@react-three/fiber';
import { handleOf } from './sharedTexture';

/** Whether `texture` holds the anisotropy of Godot's filter 4, which three leaves unwritten. */
function needsNearestAnisotropy(texture: THREE.Texture): boolean {
  return (
    texture.anisotropy > 1 &&
    texture.magFilter === THREE.NearestFilter &&
    texture.minFilter === THREE.NearestMipmapLinearFilter
  );
}

/**
 * The write of `texture`'s anisotropy onto the texture bound to `TEXTURE_2D`, or null where there is
 * nothing to write: a texture that holds no such anisotropy, or a GPU without the extension.
 */
function boundWriter(renderer: THREE.WebGLRenderer, texture: THREE.Texture): (() => void) | null {
  if (!needsNearestAnisotropy(texture)) return null;
  // three returns null for an extension the GPU lacks, and has nothing to write then.
  const extension = renderer.extensions.get(
    'EXT_texture_filter_anisotropic'
  ) as EXT_texture_filter_anisotropic | null;
  if (!extension) return null;
  const gl = renderer.getContext();
  const anisotropy = Math.min(texture.anisotropy, renderer.capabilities.getMaxAnisotropy());
  return () => gl.texParameterf(gl.TEXTURE_2D, extension.TEXTURE_MAX_ANISOTROPY_EXT, anisotropy);
}

/** Binds the GPU texture through three's state, so its binding cache stays true, and writes. */
function writeToStorage(renderer: THREE.WebGLRenderer, storage: WebGLTexture, write: () => void): void {
  const gl = renderer.getContext();
  renderer.state.bindTexture(gl.TEXTURE_2D, storage, gl.TEXTURE0);
  write();
}

/**
 * Writes the anisotropy of a texture that is on the GPU now, and nothing for one that is not. The
 * caller writes again after each upload, which resets it.
 */
export function writeNearestAnisotropy(renderer: THREE.WebGLRenderer, texture: THREE.Texture): void {
  const write = boundWriter(renderer, texture);
  const storage = handleOf(renderer, texture).__webglTexture;
  if (write && storage) writeToStorage(renderer, storage, write);
}

/**
 * Written for a texture drawn inside a Canvas: at once when its storage exists, as a tiled
 * texture's does, and after each upload three makes. three calls `onUpdate` right after an upload
 * with the texture still bound (r187 `WebGLTextures.js:1461`), so this starts no upload of its own.
 */
export function useNearestAnisotropy(texture: THREE.Texture | null): void {
  // The store is absent outside a Canvas, where no renderer exists.
  const renderer = useContext(context)?.getState().gl;
  useEffect(() => {
    if (!texture || !renderer) return;
    const writeToBound = boundWriter(renderer, texture);
    if (!writeToBound) return;
    const release = holdUploadWriter(texture, () => boundWriter(renderer, texture)?.());
    const storage = handleOf(renderer, texture).__webglTexture;
    if (storage) writeToStorage(renderer, storage, writeToBound);
    return release;
  }, [texture, renderer]);
}

interface UploadWriter {
  /** The live holds. Each recomputes the write from the texture, so none goes stale. */
  holds: Set<() => void>;
  /** The callback the texture had before the writer wrapped it. */
  previous: THREE.Texture['onUpdate'];
  wrapper: THREE.Texture['onUpdate'];
}

/**
 * Written only by `holdUploadWriter`: one writer for each texture, however many runs share it, so
 * an upload writes once, through the first live hold. The last hold to let go clears the entry.
 */
// eslint-disable-next-line no-restricted-syntax -- it counts holders, and the last release deletes the entry
const uploadWriters = new WeakMap<THREE.Texture, UploadWriter>();

/** Wraps `onUpdate` of `texture` so an upload writes through the first live hold. */
function wrapUpload(texture: THREE.Texture): UploadWriter {
  const previous = texture.onUpdate;
  const holds = new Set<() => void>();
  const wrapper: THREE.Texture['onUpdate'] = (uploaded) => {
    previous?.(uploaded);
    holds.values().next().value?.();
  };
  texture.onUpdate = wrapper;
  const writer = { holds, previous, wrapper };
  uploadWriters.set(texture, writer);
  return writer;
}

/** Opens a hold on the upload writer of `texture` and returns the release. `write` reads the texture afresh. */
function holdUploadWriter(texture: THREE.Texture, write: () => void): () => void {
  const held = uploadWriters.get(texture) ?? wrapUpload(texture);
  held.holds.add(write);
  return () => {
    held.holds.delete(write);
    if (held.holds.size > 0) return;
    uploadWriters.delete(texture);
    // Another hook may have wrapped this one since: its chain still reaches ours, so leave it.
    if (texture.onUpdate === held.wrapper) texture.onUpdate = held.previous;
  };
}
