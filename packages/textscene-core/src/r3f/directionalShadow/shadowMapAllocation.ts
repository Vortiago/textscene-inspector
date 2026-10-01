/**
 * Sizes a three shadow map from outside three. three builds a light's shadow texture once, from
 * `mapSize` (r186 `WebGLShadowMap.js:203`), so a new size takes effect only after the old texture
 * is freed.
 */

import * as THREE from 'three';

/** Frees the shadow's texture. three builds a new one from `mapSize` at its next shadow pass. */
export function freeShadowMap(shadow: THREE.LightShadow): void {
  shadow.dispose();
  shadow.map = null;
  shadow.mapPass = null;
}

/**
 * Written only by `sizeShadowMap`: the size each shadow last asked for. three can shrink `mapSize`
 * to the device's texture limit (`WebGLShadowMap.js:180-196`), so the request, not `mapSize`, says
 * whether the size changed. An entry goes with its shadow.
 */
const requestedSizes = new WeakMap<THREE.LightShadow, THREE.Vector2>();

/** Gives the shadow a `width` by `height` map, and frees its texture only when that size changes. */
export function sizeShadowMap(shadow: THREE.LightShadow, width: number, height: number): void {
  const requested = requestedSizes.get(shadow);
  if (requested && requested.x === width && requested.y === height) return;
  requestedSizes.set(shadow, new THREE.Vector2(width, height));
  shadow.mapSize.set(width, height);
  freeShadowMap(shadow);
}
