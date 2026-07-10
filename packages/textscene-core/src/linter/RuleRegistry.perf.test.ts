/**
 * Perf regression test for `getRulesForNodeType`.
 *
 * `Linter.lintNode` calls `getRulesForNodeType(node.type)` once per node in
 * the scene. The unfixed implementation re-materializes the FULL registered-
 * rule array (`Array.from(this.rules.values())`) and re-filters it on every
 * single call, so its cost per call is proportional to the total number of
 * REGISTERED rules (R) regardless of how many times it's been called before
 * for that same type. Real scenes call this many times (M, once per node)
 * for the same handful of node types, so the fix caches the filtered result
 * per node type: the first lookup for a type still costs O(R), every
 * subsequent lookup for that SAME type is O(matches), independent of R.
 *
 * The discriminating axis here is registered-rule COUNT (R), not node count:
 * with M (call count) held fixed, growing R should barely move the cached
 * total time (dominated by the constant M lookups plus one O(R) build),
 * whereas the unfixed per-call re-filter scales M*R directly with R.
 *
 * This measures real (but tiny) per-call costs, so — matching the timing-test
 * convention used for the linter-tree-walk perf test — it takes the MIN of
 * several trials per side (filters out one-off scheduler/GC hiccups rather
 * than being skewed by them) and uses a generous ratio threshold well below
 * the ~10x an uncached, rule-count-proportional lookup would show.
 */

import { describe, expect, it } from 'vitest';
import { RuleRegistry } from './RuleRegistry.js';
import type { LintRule } from './types.js';

function registerManyRules(registry: RuleRegistry, count: number): void {
  for (let i = 0; i < count; i++) {
    // Each rule targets its OWN distinct node type, so none of them match
    // the 'MeshInstance3D' type queried below — growing this count grows
    // the registry without growing the match count for our target type.
    const rule: LintRule = {
      meta: {
        name: `generated-rule-${i}`,
        description: 'perf fixture rule',
        category: 'validation',
        applicableNodeTypes: [`GeneratedType${i}`],
      },
      check: () => [],
    };
    registry.register(rule);
  }

  // A handful of rules that DO match 'MeshInstance3D' (a universal rule plus
  // a couple of exact-type rules), independent of `count`, so each cached
  // lookup copies a small-but-real array — representative of a real registry
  // where several rules apply per node type, and large enough that the
  // per-call cost isn't dwarfed by pure loop/timer overhead.
  for (let i = 0; i < 3; i++) {
    registry.register({
      meta: {
        name: `matching-rule-${i}`,
        description: 'perf fixture matching rule',
        category: 'validation',
        applicableNodeTypes: ['MeshInstance3D'],
      },
      check: () => [],
    });
  }
}

function timeManyLookups(registry: RuleRegistry, calls: number): number {
  const start = performance.now();
  for (let i = 0; i < calls; i++) {
    registry.getRulesForNodeType('MeshInstance3D');
  }
  return performance.now() - start;
}

/** Best-of-`trials` timing, isolating steady-state cost from transient hiccups. */
function bestOf(registry: RuleRegistry, calls: number, trials: number): number {
  let best = Infinity;
  for (let t = 0; t < trials; t++) {
    best = Math.min(best, timeManyLookups(registry, calls));
  }
  return best;
}

describe('RuleRegistry.getRulesForNodeType performance', () => {
  it('stays close to constant in registered-rule count once cached, not proportional to it', () => {
    const CALLS = 20000; // fixed: simulates linting a scene with this many nodes
    const TRIALS = 3;
    const SMALL_RULE_COUNT = 100;
    const BIG_RULE_COUNT = SMALL_RULE_COUNT * 10;

    const smallRegistry = new RuleRegistry();
    registerManyRules(smallRegistry, SMALL_RULE_COUNT);
    // Warm the cache (and the JIT) before timing, isolating steady-state
    // per-call cost (the interesting number: repeated calls for the same type).
    smallRegistry.getRulesForNodeType('MeshInstance3D');
    const smallMs = bestOf(smallRegistry, CALLS, TRIALS);

    const bigRegistry = new RuleRegistry();
    registerManyRules(bigRegistry, BIG_RULE_COUNT);
    bigRegistry.getRulesForNodeType('MeshInstance3D');
    const bigMs = bestOf(bigRegistry, CALLS, TRIALS);

    const ratio = bigMs / Math.max(smallMs, 1);

    // 10x the registered rules: an uncached re-filter-per-call scales ~10x
    // with rule count (linear in R, since M is fixed). Caching keeps this
    // close to constant. A generous threshold well below 10x still clearly
    // rejects the uncached behavior while tolerating shared-machine noise.
    expect(ratio).toBeLessThan(6);
  });
});
