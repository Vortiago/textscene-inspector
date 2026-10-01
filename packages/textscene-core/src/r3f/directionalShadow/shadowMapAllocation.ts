/**
 * Frees a shadow map three no longer renders. three builds a light's map when it has none
 * (r186 `WebGLShadowMap.js:203`), and resizes it when `mapSize` × `getFrameExtents()` changes
 * (`:281-285`). A light hidden from the render keeps its map until something frees it.
 */

import type * as THREE from 'three';

/** Frees the shadow's texture. three builds a new one from `mapSize` at its next shadow pass. */
export function freeShadowMap(shadow: THREE.LightShadow): void {
  shadow.dispose();
  shadow.map = null;
  shadow.mapPass = null;
}
