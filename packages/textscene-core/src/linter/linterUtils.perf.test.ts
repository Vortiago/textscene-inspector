/**
 * Perf regression test for the NodePath-resolution helpers.
 *
 * Semantic lint rules call `findParentNode` / `resolveNodePathTarget` (which
 * itself calls `findNodesByName` and `isUnderInstance`) once per matching
 * node, and each of those used to re-walk the ENTIRE scene tree from scratch
 * every single call. On a scene with N nodes, checking every node this way
 * costs O(N) per lookup * O(N) nodes = O(N^2) total — the "per-node rule
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
 */

import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../parser/types.js';
import { findParentNode, resolveNodePathTarget } from './linterUtils.js';

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
  for (const leaf of leaves) {
    findParentNode(roots, leaf);
    // "Nonexistent" so resolution always reaches the missing case, exercising
    // the full findNodesByName scan (the realistic worst case for a rule
    // checking a NodePath that doesn't resolve).
    resolveNodePathTarget(roots, leaf, 'Nonexistent');
  }
}

/** Best-of-`trials` timing for repeated lookups against the SAME tree. */
function bestOf(roots: TscnNode[], leaves: TscnNode[], trials: number): number {
  let best = Infinity;
  for (let t = 0; t < trials; t++) {
    const start = performance.now();
    runLookupsForEveryNode(roots, leaves);
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

    const smallMs = bestOf(smallTree, smallLeaves, TRIALS);
    const bigMs = bestOf(bigTree, bigLeaves, TRIALS);

    const ratio = bigMs / Math.max(smallMs, 1);

    // 4x the nodes: linear predicts ~4x time, quadratic predicts ~16x.
    // A generous threshold well below quadratic still clearly rejects it
    // while tolerating shared-machine noise.
    expect(ratio).toBeLessThan(8);
  });
});
