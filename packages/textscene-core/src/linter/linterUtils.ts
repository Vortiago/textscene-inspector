/** Small shared helpers for node-type semantic linters. */

import type { TscnNode } from '../parser/types.js';

/**
 * Narrow a node's `properties` to a string-keyed record before reading raw
 * values in a semantic rule. Was duplicated verbatim in every node-type
 * `linter.ts` (architecture review S-2).
 */
export function isValidProperties(props: unknown): props is Record<string, string> {
  return typeof props === 'object' && props !== null;
}

/**
 * Precomputed scene-tree facts, built in ONE depth-first pass, that the
 * NodePath-resolution helpers below used to recompute (via a fresh full-tree
 * walk) on EVERY call. A semantic rule calls these once per matching node, so
 * without this cache checking every node in an N-node scene cost O(N) per
 * lookup * O(N) nodes = O(N^2) total; with it, the first lookup against a
 * given tree pays the one O(N) walk and every lookup after (same tree) is
 * O(1) (or O(matches) for name lookups).
 */
interface SceneIndex {
  /** node -> its parent, or `null` for a root. Absent key = node not in this tree. */
  parentOf: Map<TscnNode, TscnNode | null>;
  /** name -> every node with that name, in depth-first order. */
  byName: Map<string, TscnNode[]>;
  /** Nodes that have an ANCESTOR (not themselves) with `instance` set. */
  underInstanceAncestor: Set<TscnNode>;
}

/**
 * Cache keyed by the roots array's own identity. Correct as long as the tree
 * under a given roots reference is immutable for that reference's lifetime —
 * true here: a parsed `scene.nodes` is never mutated in place, and each parse
 * produces a fresh array, so there is no cross-scene staleness and entries
 * are GC'd along with the tree once nothing else references it. A caller
 * that mutates a tree in place and re-queries the SAME array reference would
 * see stale results — nothing in this codebase does that today.
 */
const sceneIndexCache = new WeakMap<TscnNode[], SceneIndex>();

function buildSceneIndex(roots: TscnNode[]): SceneIndex {
  const parentOf = new Map<TscnNode, TscnNode | null>();
  const byName = new Map<string, TscnNode[]>();
  const underInstanceAncestor = new Set<TscnNode>();

  const walk = (nodes: TscnNode[], parent: TscnNode | null, ancestorIsInstance: boolean): void => {
    for (const node of nodes) {
      parentOf.set(node, parent);

      const named = byName.get(node.name);
      if (named) named.push(node);
      else byName.set(node.name, [node]);

      if (ancestorIsInstance) underInstanceAncestor.add(node);

      walk(node.children, node, ancestorIsInstance || Boolean(node.instance));
    }
  };
  walk(roots, null, false);

  return { parentOf, byName, underInstanceAncestor };
}

function getSceneIndex(roots: TscnNode[]): SceneIndex {
  let index = sceneIndexCache.get(roots);
  if (!index) {
    index = buildSceneIndex(roots);
    sceneIndexCache.set(roots, index);
  }
  return index;
}

/**
 * Find the parent of `target` in the node tree, or null when it is a root (no
 * parent) or absent. Shared by the linters that validate parent type — e.g.
 * CollisionShape2D/3D (must sit under a physics body) and PathFollow2D/3D (must
 * sit under a Path2D/Path3D).
 *
 * The common (default-`parent`) call is answered from the cached scene index
 * in O(1). The `parent` param only exists for the rare custom-subtree walk
 * with an explicit starting parent — no current caller does this, but the
 * manual recursive fallback below preserves that behavior exactly.
 */
export function findParentNode(
  nodes: TscnNode[],
  target: TscnNode,
  parent: TscnNode | null = null
): TscnNode | null {
  if (parent === null) {
    return getSceneIndex(nodes).parentOf.get(target) ?? null;
  }
  for (const node of nodes) {
    if (node === target) return parent;
    const found = findParentNode(node.children, target, node);
    if (found !== null) return found;
  }
  return null;
}

/**
 * Extract the inner path from a `NodePath("...")` literal, or null when `value`
 * is not a NodePath literal or wraps an empty path. Shared by the NodePath-target
 * linters (MeshInstance3D skeleton, GPUParticles3D sub-emitter, AnimationTree
 * anim_player) that resolve a node reference before checking its type.
 */
export function extractNodePath(value: string): string | null {
  const match = value.match(/^NodePath\("([^"]*)"\)$/);
  return match && match[1] ? match[1] : null;
}

/**
 * Collect every node named `name` anywhere in the scene tree (depth-first).
 * The NodePath-target linters resolve a path's final segment by name; collecting
 * ALL matches (rather than the first) lets them detect the ambiguous case —
 * Godot allows node names to repeat across different parents, and the static
 * linter cannot tell which one a path means without full relative resolution.
 *
 * The common (default-`out`) call is answered from the cached scene index's
 * name map in O(matches). `out` only accumulates across recursive descent for
 * a caller that deliberately reuses an accumulator across several top-level
 * calls (no current caller does) — the manual walk below preserves that.
 */
export function findNodesByName(nodes: TscnNode[], name: string, out: TscnNode[] = []): TscnNode[] {
  if (out.length === 0) {
    const matches = getSceneIndex(nodes).byName.get(name);
    if (matches) out.push(...matches);
    return out;
  }
  for (const node of nodes) {
    if (node.name === name) out.push(node);
    findNodesByName(node.children, name, out);
  }
  return out;
}

/**
 * True when `target` has an ancestor that is an instanced sub-scene (`instance=`).
 * Such a node's NodePath references can resolve into sub-scene internals the
 * static linter never sees, so not-found / wrong-type assertions are unsafe.
 * The "an ancestor was an instance" flag is carried down the walk, so the answer
 * is found without materializing any ancestor arrays.
 *
 * The common (default-`ancestorIsInstance`) call is answered from the cached
 * scene index in O(1); the manual fallback below preserves the rare
 * explicit-flag custom-subtree-walk behavior (no current caller uses it).
 */
export function isUnderInstance(roots: TscnNode[], target: TscnNode, ancestorIsInstance = false): boolean {
  if (!ancestorIsInstance) {
    return getSceneIndex(roots).underInstanceAncestor.has(target);
  }
  for (const node of roots) {
    if (node === target) {
      return ancestorIsInstance;
    }
    if (isUnderInstance(node.children, target, ancestorIsInstance || Boolean(node.instance))) {
      return true;
    }
  }
  return false;
}

/**
 * True when a NodePath cannot be safely resolved against the authored root scope
 * — either a relative (`..`) segment escapes that scope, or the referencing node
 * sits under an instanced sub-scene whose internals the linter never sees. In
 * both cases a not-found / wrong-type assertion would be a false positive, so
 * callers should skip the check. Keep strict checking only for purely-local,
 * non-relative paths under authored root nodes.
 */
export function nodePathEscapesAuthoredScope(
  roots: TscnNode[],
  referencingNode: TscnNode,
  pathParts: string[]
): boolean {
  return pathParts.some(part => part === '..') || isUnderInstance(roots, referencingNode);
}

/**
 * Outcome of resolving a NodePath property's target against the STATIC authored
 * tree. The NodePath-target rules (anim_player, skeleton, sub_emitter) diagnose
 * ONLY when resolution is confident, and stay silent otherwise — the linter is
 * React/THREE-free (cannot see into instanced sub-scenes) and Godot allows node
 * names to repeat across parents:
 *  - `escapes`   — a `..` segment leaves authored scope, or the referencing node
 *                  sits under an instance; the real target may be unseeable.
 *  - `ambiguous` — more than one node matches the path's final segment, so the
 *                  linter cannot tell which is meant (don't guess by tree order).
 *  - `missing`   — no node matches: a confident not-found.
 *  - `found`     — exactly one node matches: a confident target to type-check.
 */
export type NodePathResolution =
  | { status: 'escapes' }
  | { status: 'ambiguous' }
  | { status: 'missing' }
  | { status: 'found'; node: TscnNode };

export function resolveNodePathTarget(
  roots: TscnNode[],
  referencingNode: TscnNode,
  path: string
): NodePathResolution {
  const pathParts = path.split('/');
  if (nodePathEscapesAuthoredScope(roots, referencingNode, pathParts)) {
    return { status: 'escapes' };
  }
  const name = pathParts[pathParts.length - 1] ?? '';
  const matches = findNodesByName(roots, name);
  if (matches.length === 0) return { status: 'missing' };
  if (matches.length > 1) return { status: 'ambiguous' };
  return { status: 'found', node: matches[0]! };
}
