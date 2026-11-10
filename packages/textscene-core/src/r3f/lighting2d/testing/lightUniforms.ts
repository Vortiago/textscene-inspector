/** The uniforms a lit canvas item shares with the light pass, with real values for a compile test. */

import * as THREE from 'three';
import { CanvasItemMaterialLightMode } from '../../../godot/scene/canvasItemMaterial';
import type { CanvasItemLightingUniforms } from '../canvasItemLighting';
import type { NormalMappedLightingUniforms } from '../normalMappedLighting';

export function lightUniforms(): CanvasItemLightingUniforms {
  return {
    lightBuffer: { value: new THREE.Texture() },
    shadowTintBuffer: { value: new THREE.Texture() },
    isLit: { value: 0 },
    resolution: { value: new THREE.Vector2(2, 2) },
    canvasModulate: { value: new THREE.Vector3(1, 1, 1) },
    lightMode: { value: CanvasItemMaterialLightMode.NORMAL },
    isLinearCanvas: { value: 0 },
  };
}

/** The uniforms of a normal-mapped item, with real values for a compile test. */
export function normalMappedUniforms(): NormalMappedLightingUniforms {
  return {
    ...lightUniforms(),
    lightLayers: { value: new THREE.DataArrayTexture() },
    shadowTintLayers: { value: new THREE.DataArrayTexture() },
    places: { value: [new THREE.Vector3()] },
    modes: { value: [new THREE.Vector3()] },
    normalMap: { value: new THREE.Texture() },
    specularMap: { value: new THREE.Texture() },
    specular: { value: new THREE.Vector4(1, 1, 1, 1) },
    usesSpecular: { value: 0 },
  };
}
