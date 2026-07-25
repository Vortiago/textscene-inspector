/**
 * Memoizes boolean results across renders and reparses.
 *
 * This is the cache that matters. Boolean evaluation is synchronous CPU work, and the web
 * source pane reparses on every keystroke (ADR-0020) while the VS Code extension reparses
 * on every save (ADR-0021). Without a content-keyed cache, typing one character in a
 * scene with CSG re-runs every boolean in it.
 *
 * Module-level rather than a React ref, because the point is to survive the remount that
 * a reparse causes.
 */

import type * as THREE from 'three';
import type { CsgEvaluation } from './evaluateCsgPlan';

/**
 * Small on purpose. Entries are whole evaluated meshes, and a scene has a handful of CSG
 * roots, not hundreds: `scenes/demos/3d/csg/csg.tscn` is the largest in the corpus at
 * eight independent roots.
 */
const MAX_ENTRIES = 16;

const cache = new Map<string, CsgEvaluation>();

export function getCachedEvaluation(key: string): CsgEvaluation | undefined {
  const hit = cache.get(key);
  if (hit) {
    // Re-insert so the least recently USED entry is evicted, not the oldest inserted.
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
}

export function setCachedEvaluation(key: string, evaluation: CsgEvaluation): void {
  cache.set(key, evaluation);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    const evicted = cache.get(oldest.value);
    cache.delete(oldest.value);
    // r3f never disposes geometry it did not create, and these were built here.
    evicted?.geometry.dispose();
  }
}

/** Test seam, and the hook HMR needs so a stale evaluation cannot outlive an edit. */
export function clearEvaluationCache(): void {
  for (const evaluation of cache.values()) {
    (evaluation.geometry as THREE.BufferGeometry).dispose();
  }
  cache.clear();
}
