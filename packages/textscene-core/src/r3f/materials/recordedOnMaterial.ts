/**
 * The one reader for a value a derivation records on a material's `userData` for its patches and
 * draw hooks to read back.
 */

import type * as THREE from 'three';

/** The value `material` records under `key`, or `fallback` for a material that records none. */
export function recordedOn<T>(material: THREE.Material, key: string, fallback: T): T {
  return (material.userData[key] as T | undefined) ?? fallback;
}
