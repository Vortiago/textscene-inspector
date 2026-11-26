import * as THREE from 'three';
import type { ScopedReference } from './reading';
import { proceduralTexture3D } from './textures/resolveProceduralTexture.js';
import { TEXTURE_3D } from './textures/texture3d/kind.js';
import type { Texture3D } from './textures/texture3d/types.js';
import {
  useLayeredTexture,
  useLayeredTextureState,
  type LayeredTextureSlot,
  type LayeredTextureState,
} from './useLayeredTexture.js';

const TEXTURE_3D_SLOT: LayeredTextureSlot<Texture3D, THREE.Data3DTexture> = {
  kind: TEXTURE_3D,
  procedural: proceduralTexture3D,
  busType: 'texture3d',
  isBuilt: (texture): texture is THREE.Data3DTexture => texture instanceof THREE.Data3DTexture,
};

/** The volume a Texture3D slot reads: a `NoiseTexture3D`, an `ImageTexture3D`, or an imported image. */
export function useTexture3D(reference: ScopedReference | null): THREE.Data3DTexture | null {
  return useLayeredTexture(reference, TEXTURE_3D_SLOT);
}

/** The volume a Texture3D slot reads, and whether it is on its way or never draws. */
export function useTexture3DState(
  reference: ScopedReference | null
): LayeredTextureState<THREE.Data3DTexture> {
  return useLayeredTextureState(reference, TEXTURE_3D_SLOT);
}
