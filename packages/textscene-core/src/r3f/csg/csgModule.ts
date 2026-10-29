/**
 * The one place `three-bvh-csg` is imported, and lazily: a static import puts the CSG core and
 * `three-mesh-bvh` on the webview's initial-paint path for every scene. `csgImportSite.contract.test.ts`
 * holds the import to this file.
 */

import type * as THREE from 'three';
import { memoisedImport } from '../../resources/memoisedImport';

/** The slice of three-bvh-csg's surface this codebase uses. */
export interface CsgModule {
  Brush: new (geometry?: THREE.BufferGeometry, material?: THREE.Material | THREE.Material[]) => THREE.Mesh;
  Evaluator: new () => {
    useGroups: boolean;
    evaluate: (a: THREE.Mesh, b: THREE.Mesh, operation: number, target?: THREE.Mesh) => THREE.Mesh;
  };
  ADDITION: number;
  SUBTRACTION: number;
  INTERSECTION: number;
}

/** Load the CSG library once, shared by every caller. A failed import stays failed. */
export const loadCsgModule = memoisedImport(() =>
  import('three-bvh-csg').then((m) => m as unknown as CsgModule)
);

/**
 * Starts the load without waiting, as soon as a parsed scene holds any CSG type, so the boolean
 * result reaches the opening frame sooner. `CameraFit` re-frames it only once the loader settles.
 */
export function prefetchCsgModule(): void {
  void loadCsgModule().catch(() => {
    // Swallowed deliberately. The real load path reports the failure and degrades to
    // base primitives; a prefetch must not surface as an unhandled rejection.
  });
}
