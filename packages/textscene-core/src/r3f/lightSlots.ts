/**
 * The slots three's `WebGLLights` gives the lights `RE_Direct` shades, which a uniform array of
 * Godot terms reads by: directional lights, then sun lights, then point lights, then spot lights.
 */

import type * as THREE from 'three';
import type { SceneLight } from './directionalShadow/lightLists.js';

/** The kinds `RE_Direct` shades, in the order the array holds them. */
export const LIGHT_KINDS = ['directional', 'sun', 'point', 'spot'] as const;
export type LightKind = (typeof LIGHT_KINDS)[number];

/** The kind three's `WebGLLights` files the light under, which tests a sun before a directional light. */
function kindOf(light: THREE.Light): LightKind | null {
  const flags = light as THREE.Light & {
    isSunLight?: boolean;
    isDirectionalLight?: boolean;
    isPointLight?: boolean;
    isSpotLight?: boolean;
  };
  if (flags.isSunLight) return 'sun';
  if (flags.isDirectionalLight) return 'directional';
  if (flags.isSpotLight) return 'spot';
  if (flags.isPointLight) return 'point';
  return null;
}

/** three's own sort: shadowed lights first, then lights with a map (r186 `WebGLLights.js:152-156`). */
function shadowedAndTexturedFirst(a: THREE.Light, b: THREE.Light): number {
  const rank = (light: THREE.Light) => (light.castShadow ? 2 : 0) + ((light as THREE.SpotLight).map ? 1 : 0);
  return rank(b) - rank(a);
}

/**
 * The lights three gives a slot when it renders through `camera`, by kind, each in slot order:
 * visible, on a layer the camera sees, in tree order (r186 `WebGLRenderer.js:1860-1882`), then
 * through three's stable sort (`WebGLLights.js:245`).
 */
export function slottedLights(
  lights: readonly SceneLight[],
  camera: THREE.Camera
): Record<LightKind, THREE.Light[]> {
  const slotted: Record<LightKind, THREE.Light[]> = { directional: [], sun: [], point: [], spot: [] };
  const rendered = lights
    .filter(({ light, isVisible }) => isVisible && light.layers.test(camera.layers))
    .map(({ light }) => light)
    .sort(shadowedAndTexturedFirst);
  for (const light of rendered) {
    const kind = kindOf(light);
    if (kind) slotted[kind].push(light);
  }
  return slotted;
}
