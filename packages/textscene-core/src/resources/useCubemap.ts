import * as THREE from 'three';
import type { ScopedReference } from './reading';
import { proceduralCubemap } from './textures/resolveProceduralTexture.js';
import { CUBEMAP } from './textures/cubemap/kind.js';
import {
  useLayeredTexture,
  useLayeredTextureState,
  type LayeredTextureSlot,
  type LayeredTextureState,
} from './useLayeredTexture.js';
import type { CubemapSource } from './textures/cubemap/types.js';

const CUBEMAP_SLOT: LayeredTextureSlot<CubemapSource, THREE.CubeTexture> = {
  kind: CUBEMAP,
  procedural: proceduralCubemap,
  busType: 'cubemap',
  isBuilt: (texture): texture is THREE.CubeTexture => texture instanceof THREE.CubeTexture,
};

/** The cube a Cubemap slot reads. Null while it loads, for none, and for a form it cannot build. */
export function useCubemap(reference: ScopedReference | null): THREE.CubeTexture | null {
  return useLayeredTexture(reference, CUBEMAP_SLOT);
}

/** The cube a Cubemap slot reads, and whether it is on its way or never draws. */
export function useCubemapState(reference: ScopedReference | null): LayeredTextureState<THREE.CubeTexture> {
  return useLayeredTextureState(reference, CUBEMAP_SLOT);
}
