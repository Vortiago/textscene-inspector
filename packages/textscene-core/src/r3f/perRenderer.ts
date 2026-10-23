/**
 * A value each renderer gets once, made on its first ask. Three leaves a dispose listener that
 * closes over the renderer on each geometry and material it draws, so a mesh or a pass shared by
 * every renderer keeps each renderer that drew it alive. An entry here goes with its renderer.
 */

import type * as THREE from 'three';
import { perObject } from '../utils/perObject.js';

/** The value `create` makes for each renderer, the same value on every later ask. */
export function perRenderer<T extends object>(create: () => T): (renderer: THREE.WebGLRenderer) => T {
  return perObject<THREE.WebGLRenderer, T>(create);
}
