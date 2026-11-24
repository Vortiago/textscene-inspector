/** The three.js lights that stand for the environment's ambient, not for a Light3D of the scene. */

import type * as THREE from 'three';

/**
 * @canonical Whether a light stands for the environment's ambient
 */
export function isAmbientLight(object: THREE.Object3D): object is THREE.Light {
  const o = object as THREE.Object3D & Record<string, unknown>;
  return !!(o.isAmbientLight || o.isHemisphereLight || o.isLightProbe);
}

/** Godot adds `ambient_light * albedo` with no 1/PI, while three multiplies the colour by `albedo/PI`. */
const FLAT_AMBIENT_SCALE = Math.PI;

/** The intensity of the `AmbientLight` that stands for a flat ambient of `energy`. */
export function flatAmbientIntensity(energy: number): number {
  return energy * FLAT_AMBIENT_SCALE;
}

/** The energy of the flat ambient that `light` stands for, the inverse of `flatAmbientIntensity`. */
export function flatAmbientEnergy(light: THREE.AmbientLight): number {
  return light.intensity / FLAT_AMBIENT_SCALE;
}
