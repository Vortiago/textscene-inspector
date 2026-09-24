/**
 * Memoises boolean results across renders and reparses. Evaluation is synchronous CPU work, and the
 * web source pane reparses on each keystroke (ADR-0020), the extension on each save (ADR-0021).
 * Module-level rather than a React ref, so it survives the remount a reparse causes.
 */

import { LRUCache } from '../../resources/LRUCache';
import type { CsgEvaluation } from './evaluateCsgPlan';

/**
 * Small on purpose. Entries are whole evaluated meshes, and a scene has a handful of CSG
 * roots, not hundreds.
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
