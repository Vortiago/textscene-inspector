/** Scales the intensity of a set of lights for a while, as an exposure scales each Light3D. */

import type * as THREE from 'three';

/**
 * Multiplies the intensity of each of `lights` by `factor`, and answers the call that puts back the
 * intensity each held.
 *
 * @canonical Scale the intensity of lights and put it back
 */
export function scaleLightIntensities(lights: readonly THREE.Light[], factor: number): () => void {
  const held = lights.map((light) => ({ light, intensity: light.intensity }));
  for (const { light, intensity } of held) light.intensity = intensity * factor;
  return () => {
    for (const { light, intensity } of held) light.intensity = intensity;
  };
}
