/** The uniforms a lit canvas item shares with the light pass, with real values for a compile test. */

import * as THREE from 'three';
import { CanvasItemMaterialLightMode } from '../../../godot/scene/canvasItemMaterial';
import type { CanvasItemLightingUniforms } from '../canvasItemLighting';

export function lightUniforms(): CanvasItemLightingUniforms {
  return {
    lightBuffer: { value: new THREE.Texture() },
    shadowTintBuffer: { value: new THREE.Texture() },
    isLit: { value: 0 },
    resolution: { value: new THREE.Vector2(2, 2) },
    canvasModulate: { value: new THREE.Vector3(1, 1, 1) },
    lightMode: { value: CanvasItemMaterialLightMode.NORMAL },
  };
}
