/**
 * The one reader for a value a derivation records on a material's `userData` for its patches and
 * draw hooks to read back.
 */

import type * as THREE from 'three';

/** The value `material` records under `key`, or `fallback` for a material that records none. */
export function recordedOn<T>(material: Pick<THREE.Material, 'userData'>, key: string, fallback: T): T {
  return (material.userData[key] as T | undefined) ?? fallback;
}

/**
 * A uniform that reads the value `material` records under `key` at each upload, so a re-parse that
 * changes only that value needs no recompile.
 */
export function recordedUniform<T>(
  material: Pick<THREE.Material, 'userData'>,
  key: string,
  fallback: T
): THREE.IUniform<T> {
  return {
    get value() {
      return recordedOn(material, key, fallback);
    },
  };
}
