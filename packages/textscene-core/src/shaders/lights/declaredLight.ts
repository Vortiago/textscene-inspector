/**
 * The light whose declarations a light reads. A light that stands in for another, as the renderer's
 * split sun stands in for the directional light it hangs under, shades with that light's
 * declarations and says so through `declaredLight`.
 */

import type * as THREE from 'three';

/** A light that shades for another one. */
interface StandInLight {
  /** The light it shades for, or null while it hangs under none. */
  readonly declaredLight: THREE.Object3D | null;
}

function isStandIn(light: THREE.Light): light is THREE.Light & StandInLight {
  return 'declaredLight' in light;
}

/** The light whose declarations `light` reads. Nothing for a stand-in off its light. */
export function declaredLightOf(light: THREE.Light): THREE.Object3D | null {
  return isStandIn(light) ? light.declaredLight : light;
}
