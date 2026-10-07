/**
 * The starting material of a draw that owns one surface of a shared multi-surface geometry.
 */
import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * The material of a surface another draw owns. three skips a draw group whose material is
 * invisible, in the colour pass (`WebGLRenderer.js:1948`) and the shadow pass
 * (`WebGLShadowMap.js:542`). Shared by every draw and never disposed.
 */
const OTHER_DRAWS_SURFACE = new THREE.MeshBasicMaterial({ visible: false });

/**
 * One entry per draw group, each hiding its group until the owned surface's slot attaches over
 * its entry. A one-surface mesh has no groups and starts with three's default material.
 */
export function useOneSurfaceStartingMaterial(surfaceCount: number): THREE.Material[] | undefined {
  return useMemo(
    () => (surfaceCount > 1 ? Array.from({ length: surfaceCount }, () => OTHER_DRAWS_SURFACE) : undefined),
    [surfaceCount]
  );
}
