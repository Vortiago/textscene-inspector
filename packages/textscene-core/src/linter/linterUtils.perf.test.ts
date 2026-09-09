/**
 * Perf regression test for the NodePath-resolution helpers.
 *
 * Semantic lint rules call `findParentNode` / `resolveNodePath` (which
 * itself calls `findNodesByName` and `isUnderInstance`) once per matching
 * node. Re-walking the ENTIRE scene tree per call costs O(N) per lookup *
 * O(N) nodes = O(N^2) total on a scene with N nodes — the "per-node rule
 * filtering + O(N^2) NodePath helpers" half of the throughput regression.
 *
 * This test simulates that call pattern directly (one lookup per node, over
 * a large/wide tree) and asserts the cost scales close to linearly with node
 * count rather than quadratically. Unlike the multiline-parser perf test
 * (whose blowup is dramatic enough for an absolute wall-clock ceiling), this
 * blowup is milder at test-friendly sizes, so a scaling-ratio assertion
 * across two sizes is the more robust discriminator: quadratic predicts a
 * ~16x slowdown for a 4x size increase, linear predicts ~4x — a threshold in
 * between cleanly tells them apart without being sensitive to absolute timer
 * noise. Each side takes the MIN of several trials (filters transient
 * scheduler/GC hiccups rather than being skewed by them), matching the
 * timing-test convention used for the RuleRegistry perf test.
 *
 * Robustness: a single ratio measurement still flakes under heavy parallel
 * machine load (observed 8.2-13.7 against the 8x threshold when the big side
 * absorbed a sustained scheduler stall that outlived all of its trials), so
 * the assertion takes the BEST ratio across several independent measurements,
 * stopping early once one lands under the threshold. A genuinely quadratic
 * implementation (~16x) cannot pass: per-side best-of already filters
 * inflation, so beating the threshold would require the small side alone to
 * be inflated ~2x across ALL of its trials in the same measurement where the
 * big side runs clean — the exact pattern the per-side min removes.
 */

import { describe, expect, it } from 'vitest';
import type { TscnNode, TscnScene } from '../parser/types.js';
import { findParentNode } from './linterUtils.js';
import { resolveNodePath } from './nodePathResolve.js';

/**
 * A wide, shallow tree (root -> groups -> leaves) so the traversal-depth cost
 * of the tree-building helper itself doesn't dominate — the perf question
 * under test is repeated FULL-TREE walks per lookup, not stack depth.
 */
function buildWideTree(leafCount: number): TscnNode[] {
  const groupSize = 50;
  const groupCount = Math.ceil(leafCount / groupSize);
  const groups: TscnNode[] = [];
  let remaining = leafCount;

  for (let g = 0; g < groupCount; g++) {
    const countInGroup = Math.min(groupSize, remaining);
    remaining -= countInGroup;
    const leaves: TscnNode[] = [];
    for (let l = 0; l < countInGroup; l++) {
      leaves.push({
        name: `Leaf${g}_${l}`,
        type: 'Node3D',
        children: [],
        properties: {},
      });
    }
    groups.push({
      name: `Group${g}`,
      type: 'Node3D',
      children: leaves,
      properties: {},
    });
  }

  return [{ name: 'Root', type: 'Node3D', children: groups, properties: {} }];
}

/** Every leaf node in traversal order, for exercising one lookup per node. */
function collectLeaves(roots: TscnNode[]): TscnNode[] {
  const leaves: TscnNode[] = [];
  for (const root of roots) {
    for (const group of root.children) {
      for (const leaf of group.children) leaves.push(leaf);
    }
  }
  return leaves;
}

/** Simulate what a semantic rule does per node: resolve its parent + a NodePath. */
function runLookupsForEveryNode(roots: TscnNode[], leaves: TscnNode[]): void {
  const scene = { nodes: roots } as TscnScene;
  for (const leaf of leaves) {
    findParentNode(roots, leaf);
    // "../Nonexistent" so resolution climbs (touching the parent index) and then
    // misses, the realistic worst case for a rule checking a path that does not
    // resolve. A bare name would stop at the leaf's own empty child list.
    resolveNodePath(scene, leaf, '../Nonexistent');
  }
}

/**
 * Repetitions per timed sample. One pass over the small tree costs ~0.7ms, and
 * a sub-millisecond denominator makes the ratio below a measure of the big side
 * alone rather than of scaling. Ten puts the small side around 7ms, clear of
 * timer resolution and scheduler granularity, without paying for more.
 */
const REPEATS = 10;

/** Best-of-`trials` timing for repeated lookups against the SAME tree. */
function bestOf(roots: TscnNode[], leaves: TscnNode[], trials: number): number {
  let best = Infinity;
  for (let t = 0; t < trials; t++) {
    const start = performance.now();
    for (let r = 0; r < REPEATS; r++) runLookupsForEveryNode(roots, leaves);
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

describe('NodePath helper lookup performance', () => {
  it('scales close to linearly (not quadratically) as node count grows', () => {
    const SMALL = 1500;
    const BIG = SMALL * 4;
    const TRIALS = 3;

    const smallTree = buildWideTree(SMALL);
    const smallLeaves = collectLeaves(smallTree);
    const bigTree = buildWideTree(BIG);
    const bigLeaves = collectLeaves(bigTree);

    // Warm up JIT (and, for the fixed implementation, the per-tree scene
    // index) so measured timings reflect steady-state cost, not one-time
    // compilation/build. The unfixed implementation has no such warm state
    // to benefit from — every call costs the same O(N) walk regardless.
    // Built ONCE (not once per argument): `roots` and `leaves` must come
    // from the SAME tree, or every lookup misses the scene index (the
    // leaves aren't part of the tree the index was built from) and the
    // warmup never exercises the cache-hit path it's meant to warm.
    const warmupTree = buildWideTree(200);
    runLookupsForEveryNode(warmupTree, collectLeaves(warmupTree));
    runLookupsForEveryNode(smallTree, smallLeaves);
    runLookupsForEveryNode(bigTree, bigLeaves);

    // 4x the nodes: linear predicts ~4x time, quadratic predicts ~16x.
    // A generous threshold well below quadratic still clearly rejects it
    // while tolerating shared-machine noise.
    const THRESHOLD = 8;
    // Best-of-N on the ratio itself: one measurement can straddle a load
    // spike long enough to defeat the per-side best-of (see header comment);
    // three independent measurements cannot all do so, while a real
    // quadratic regression fails every one of them.
    const RATIO_MEASUREMENTS = 3;

    let bestRatio = Infinity;
    for (let m = 0; m < RATIO_MEASUREMENTS && bestRatio >= THRESHOLD; m++) {
      const smallMs = bestOf(smallTree, smallLeaves, TRIALS);
      const bigMs = bestOf(bigTree, bigLeaves, TRIALS);
      bestRatio = Math.min(bestRatio, bigMs / smallMs);
    }

    expect(bestRatio).toBeLessThan(THRESHOLD);
  });
});
