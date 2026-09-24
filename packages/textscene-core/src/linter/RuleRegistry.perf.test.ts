/**
 * Perf regression test for `getRulesForNodeType`, which `Linter.lintNode` calls for each node. Without the per-type cache
 * each call re-filters every registered rule, O(R). The test grows the registered-rule count R with the call count M
 * fixed: the cached time barely moves, while an uncached lookup scales M*R. It takes the minimum of several trials per
 * side, against scheduler and GC hiccups, and a ratio threshold well below the ~10x an uncached lookup shows.
 */

import { describe, expect, it } from 'vitest';
import { RuleRegistry } from './RuleRegistry.js';
import type { LintRule } from './types.js';

function registerManyRules(registry: RuleRegistry, count: number): void {
  for (let i = 0; i < count; i++) {
    // Each rule targets its own node type, so none match the 'MeshInstance3D'
    // queried below: this count grows the registry, not the match count.
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

  // Rules that do match 'MeshInstance3D', independent of `count`, so each cached lookup copies a small real array,
  // large enough that the per-call cost is not lost in loop and timer overhead.
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
