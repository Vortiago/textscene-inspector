import type * as THREE from 'three';
import { isLight } from '../../../r3f/isLight';
import { lightIntensity } from '../../../nodes/3d/lights/shared/lightStrength';

/** Godot imports a glTF light's intensity as its `light_energy` (`gltf_light.cpp:162-171`). */
export function importLightEnergies(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (isLight(object))
      object.intensity = lightIntensity({ light_energy: object.intensity, light_negative: false });
  });
}
