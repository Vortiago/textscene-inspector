/**
 * Godot's Nearest with Mipmaps and Anisotropic filter samples a nearest mip chain with anisotropy
 * (`material_storage.cpp:2490-2506`). three writes `TEXTURE_MAX_ANISOTROPY_EXT` only under a linear
 * magnification filter (`WebGLTextures.js:695`), so this writes it onto the GPU texture itself.
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
 * with the texture still bound (`WebGLTextures.js:1399`), so this starts no upload of its own.
 */
export function useNearestAnisotropy(texture: THREE.Texture | null): void {
  // The store is absent outside a Canvas, where no renderer exists.
  const renderer = useContext(context)?.getState().gl;
  useEffect(() => {
    if (!texture || !renderer) return;
    const writeToBound = boundWriter(renderer, texture);
    if (!writeToBound) return;

    const previous = texture.onUpdate;
    const onUpdate: THREE.Texture['onUpdate'] = (uploaded) => {
      previous?.(uploaded);
      writeToBound();
    };
    texture.onUpdate = onUpdate;

    const storage = handleOf(renderer, texture).__webglTexture;
    if (storage) writeToStorage(renderer, storage, writeToBound);
    return () => {
      // Another hook may have wrapped this one since: its chain still reaches ours, so leave it.
      if (texture.onUpdate === onUpdate) texture.onUpdate = previous;
    };
  }, [texture, renderer]);
}
