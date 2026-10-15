/**
 * A value each renderer gets once, made on its first ask. Three leaves a dispose listener that
 * closes over the renderer on each geometry and material it draws, so a mesh or a pass shared by
 * every renderer keeps each renderer that drew it alive. An entry here goes with its renderer.
 */

import type * as THREE from 'three';

/** The value `create` makes for each renderer, the same value on every later ask. */
export function perRenderer<T extends object>(create: () => T): (renderer: THREE.WebGLRenderer) => T {
  const values = new WeakMap<THREE.WebGLRenderer, T>();
  return (renderer) => {
    const cached = values.get(renderer);
    if (cached) return cached;
    const value = create();
    values.set(renderer, value);
    return value;
  };
}
