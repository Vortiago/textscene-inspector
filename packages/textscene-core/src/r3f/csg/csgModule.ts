/**
 * The one and only place `three-bvh-csg` is imported, and it is imported LAZILY.
 *
 * Static-importing it would put the CSG core plus `three-mesh-bvh` on the webview's
 * initial-paint path. `check:bundle-size` currently reports 77 kB of headroom against a
 * 600 kB gzipped budget, and those two together would eat most of it for a feature most
 * scenes never touch.
 *
 * Keeping it to a single call site is what makes that enforceable rather than aspirational:
 * `csgImportSite.contract.test.ts` asserts no other file mentions the package, so the
 * host-bundle and linter-closure guards never have to catch it later.
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
 * Start the load without waiting for it.
 *
 * Called as soon as a parsed scene is known to contain any CSG type, because
 * `CameraFit`'s last auto-frame retry fires at 1100 ms: geometry that lands after that
 * gets framed out of the opening view, so the chunk needs to be in flight well before
 * the first CSG root mounts.
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
