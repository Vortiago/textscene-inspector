/**
 * The one place `three-bvh-csg` is imported, and lazily: a static import puts the CSG core and
 * `three-mesh-bvh` on the webview's initial-paint path for every scene. `csgImportSite.contract.test.ts`
 * holds the import to this file.
 */

import type * as THREE from 'three';

/** The slice of three-bvh-csg's surface this codebase uses. */
export interface CsgModule {
  Brush: new (geometry?: THREE.BufferGeometry, material?: THREE.Material) => THREE.Mesh;
  Evaluator: new () => {
    useGroups: boolean;
    evaluate: (a: THREE.Mesh, b: THREE.Mesh, operation: number, target?: THREE.Mesh) => THREE.Mesh;
  };
  ADDITION: number;
  SUBTRACTION: number;
  INTERSECTION: number;
}

let pending: Promise<CsgModule> | null = null;

/** Load the CSG library, memoized so every caller shares one import. */
export function loadCsgModule(): Promise<CsgModule> {
  pending ??= import('three-bvh-csg').then((m) => m as unknown as CsgModule);
  return pending;
}

/**
 * Starts the load without waiting, as soon as a parsed scene holds any CSG type. The last
 * auto-frame retry of `CameraFit` fires at 1100 ms, and geometry that lands later is framed out of
 * the opening view.
 */
export function prefetchCsgModule(): void {
  void loadCsgModule().catch(() => {
    // Swallowed deliberately. The real load path reports the failure and degrades to
    // base primitives; a prefetch must not surface as an unhandled rejection.
  });
}

/** Test seam: forget the memoized import so the failure path can be exercised. */
export function resetCsgModuleForTests(): void {
  pending = null;
}
