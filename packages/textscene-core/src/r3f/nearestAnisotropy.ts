/**
 * Godot's Nearest with Mipmaps and Anisotropic filter samples a nearest mip chain with anisotropy
 * (`material_storage.cpp:2490-2506`). three writes `TEXTURE_MAX_ANISOTROPY_EXT` only under a linear
 * magnification filter (`WebGLTextures.js:695`), so this writes it onto the GPU texture itself.
 */
import { useContext, useEffect } from 'react';
import * as THREE from 'three';
import { context } from '@react-three/fiber';

/** Whether three would sample `texture` without the anisotropy it holds. */
function isSkippedByThree(texture: THREE.Texture): boolean {
  return (
    texture.anisotropy > 1 &&
    texture.magFilter === THREE.NearestFilter &&
    texture.minFilter === THREE.NearestMipmapLinearFilter
  );
}

/**
 * Written for a texture drawn inside a Canvas, once it is committed. The parameter lives on the GPU
 * texture, so it survives three's later uploads. A tiled texture already has its empty storage here
 * and is not uploaded again; a small one is allocated now.
 */
export function useNearestAnisotropy(texture: THREE.Texture | null): void {
  // The store is absent outside a Canvas, where no renderer exists.
  const renderer = useContext(context)?.getState().gl;
  useEffect(() => {
    if (!texture || !renderer || !isSkippedByThree(texture)) return;
    const gl = renderer.getContext();
    if (!(renderer.properties.get(texture) as { __webglTexture?: WebGLTexture }).__webglTexture) {
      renderer.initTexture(texture);
    }
    const { __webglTexture: storage } = renderer.properties.get(texture) as { __webglTexture: WebGLTexture };
    // Through three's state, so its binding cache stays true.
    renderer.state.bindTexture(gl.TEXTURE_2D, storage, gl.TEXTURE0);
    const extension = renderer.extensions.get('EXT_texture_filter_anisotropic') as {
      TEXTURE_MAX_ANISOTROPY_EXT: number;
    };
    gl.texParameterf(
      gl.TEXTURE_2D,
      extension.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(texture.anisotropy, renderer.capabilities.getMaxAnisotropy())
    );
  }, [texture, renderer]);
}
