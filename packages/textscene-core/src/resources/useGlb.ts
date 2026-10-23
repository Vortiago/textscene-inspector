/** The hook every consumer of a loaded GLB reads it through. */

import type * as THREE from 'three';
import { useResource, type ResourceResult } from './useResource.js';

/** The GLB at `path`, a clone for this consumer once loaded. No path requests nothing. */
export function useGlb(path: string | undefined): ResourceResult<THREE.Object3D> {
  return useResource<THREE.Object3D>(path ?? '', 'glb');
}
