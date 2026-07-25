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

import { LRUCache } from '../../resources/LRUCache';
import type { CsgEvaluation } from './evaluateCsgPlan';

/**
 * Small on purpose. Entries are whole evaluated meshes, and a scene has a handful of CSG
 * roots, not hundreds: `scenes/demos/3d/csg/csg.tscn` is the largest in the corpus at
 * eight independent roots.
 */
const MAX_ENTRIES = 16;

// r3f never disposes geometry it did not create, and these were built here.
const cache = new LRUCache<CsgEvaluation>(MAX_ENTRIES, (_key, evaluation) =>
  evaluation.geometry.dispose()
);

export function getCachedEvaluation(key: string): CsgEvaluation | undefined {
  return cache.get(key);
}

export function setCachedEvaluation(key: string, evaluation: CsgEvaluation): void {
  cache.set(key, evaluation);
}

/** Test seam, and the hook HMR needs so a stale evaluation cannot outlive an edit. */
export function clearEvaluationCache(): void {
  cache.clear();
}
