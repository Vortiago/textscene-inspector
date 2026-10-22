/** The mipmap bias a test reads: the shared uniform a compiled program holds, and a texture that samples a mip chain. */

import * as THREE from 'three';
import { mipmapBiasInjection, viewportSamplersUserData } from '../materials/godotMipmapBias';

/** A texture with a mip chain, which a bias can change. */
export function mipmappedTexture(): THREE.Texture {
  const texture = new THREE.Texture();
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

/** The uniform every program that compiles the bias shares, read through one program's compile. */
export function mipmapBiasUniform(): THREE.IUniform<number> {
  const shader = { vertexShader: '', fragmentShader: '', uniforms: {} as Record<string, THREE.IUniform> };
  const injection = mipmapBiasInjection({ userData: viewportSamplersUserData(), map: mipmappedTexture() })!;
  injection.onBeforeCompile.call(new THREE.MeshBasicMaterial(), shader);
  return shader.uniforms['godotMipmapBias'] as THREE.IUniform<number>;
}
