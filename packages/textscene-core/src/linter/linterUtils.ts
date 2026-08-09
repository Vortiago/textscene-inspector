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
  /** type -> how many nodes in the whole tree carry it. */
  countByType: Map<string, number>;
  /** type -> the first node of that type in depth-first (= Godot tree) order. */
  firstByType: Map<string, TscnNode>;
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
  const countByType = new Map<string, number>();
  const firstByType = new Map<string, TscnNode>();

  const walk = (nodes: TscnNode[], parent: TscnNode | null, ancestorIsInstance: boolean): void => {
    for (const node of nodes) {
      parentOf.set(node, parent);

      const named = byName.get(node.name);
      if (named) named.push(node);
      else byName.set(node.name, [node]);

      countByType.set(node.type, (countByType.get(node.type) ?? 0) + 1);
      if (!firstByType.has(node.type)) firstByType.set(node.type, node);

      if (ancestorIsInstance) underInstanceAncestor.add(node);

      walk(node.children, node, ancestorIsInstance || Boolean(node.instance));
    }
  };
  walk(roots, null, false);

  // Freeze each name bucket: `findNodesByName` hands these arrays straight
  // to callers (no per-call copy, matching `RuleRegistry`'s hot-path
  // contract) — freezing here makes that contract enforced, not just documented.
  for (const matches of byName.values()) Object.freeze(matches);

  return { parentOf, byName, underInstanceAncestor, countByType, firstByType };
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
 * How many nodes of `type` the scene contains, counted once per scene.
 *
 * Several of Godot's configuration warnings are "only the first of these has an
 * effect" — `WorldEnvironment`, `ShaderGlobalsOverride`, `CanvasModulate`,
 * `Camera2D`. Each rule answered it by recursing the whole tree inside `check`,
 * which the linter calls once per matching node: O(matches x nodes), and the
 * pathological input is precisely the case those rules exist to detect. The
 * count comes off the cached per-scene index instead, built in the same single
 * walk that already produces the parent and name maps.
 *
 * Exact-name, not base-walked: Godot's own checks compare `get_class()` or scan
 * a type-keyed group, never a subclass closure.
 */
export function countNodesOfType(roots: TscnNode[], type: string): number {
  return getSceneIndex(roots).countByType.get(type) ?? 0;
}

/**
 * The first node of `type` in depth-first order, which is the one Godot's
 * `SceneTree::get_first_node_in_group` returns: `_update_group_order`
 * (`scene_tree.cpp:333-347`) sorts the group with `Node::Comparator`
 * (`node.h:132-134`), whose `is_greater_than` is tree order. Several engine
 * warnings are about being the node that did NOT win such a lookup, and that
 * winner is decidable from the file rather than only from a live tree.
 *
 * Exact-name for the same reason `countNodesOfType` is: the engine's groups are
 * keyed by concrete class, not by a subclass closure.
 */
export function firstNodeOfType(roots: TscnNode[], type: string): TscnNode | null {
  return getSceneIndex(roots).firstByType.get(type) ?? null;
}

/**
 * Find the parent of `target` in the node tree, or null when it is a root (no
 * parent) or absent. Shared by the linters that validate parent type — e.g.
 * CollisionShape2D/3D (must sit under a physics body) and PathFollow2D/3D (must
 * sit under a Path2D/Path3D). Answered from the cached scene index in O(1).
 */
export function findParentNode(nodes: TscnNode[], target: TscnNode): TscnNode | null {
  return getSceneIndex(nodes).parentOf.get(target) ?? null;
}

/**
 * Extract the inner path from a `NodePath("...")` literal, or null when `value`
 * is not a NodePath literal or wraps an empty path. Shared by the NodePath-target
 * linters (MeshInstance3D skeleton, GPUParticles3D sub-emitter, AnimationTree
 * anim_player) that resolve a node reference before checking its type.
 */
export function extractNodePath(value: string): string | null {
  // `\s*` for the reason `NODE_PATH_REGEX` carries it: Godot tokenises the
  // literal and drops whitespace before each token (variant_parser.cpp:415-417),
  // so `NodePath( "../Body" )` is a real path and reading it as "no path" made
  // the joint rules report a connected joint as unconnected.
  const match = value.match(/^NodePath\(\s*"([^"]*)"\s*\)$/);
  return match && match[1] ? match[1] : null;
}

/** Shared empty result for `findNodesByName` misses — one frozen instance, not a fresh allocation per miss. */
const NO_MATCHES: readonly TscnNode[] = Object.freeze([]);

/**
 * Collect every node named `name` anywhere in the scene tree (depth-first).
 * The NodePath-target linters resolve a path's final segment by name; collecting
 * ALL matches (rather than the first) lets them detect the ambiguous case —
 * Godot allows node names to repeat across different parents, and the static
 * linter cannot tell which one a path means without full relative resolution.
 *
 * Answered from the cached scene index's name map in O(1) — returns the
 * cached (frozen, read-only) array directly rather than a per-call copy,
 * matching `RuleRegistry.getRulesForNodeType`'s hot-path contract: this runs
 * once per NodePath property on every matching node in the scene.
 */
export function findNodesByName(nodes: TscnNode[], name: string): readonly TscnNode[] {
  return getSceneIndex(nodes).byName.get(name) ?? NO_MATCHES;
}

/**
 * True when `target` has an ancestor that is an instanced sub-scene (`instance=`).
 * Such a node's NodePath references can resolve into sub-scene internals the
 * static linter never sees, so not-found / wrong-type assertions are unsafe.
 * Answered from the cached scene index in O(1).
 */
export function isUnderInstance(roots: TscnNode[], target: TscnNode): boolean {
  return getSceneIndex(roots).underInstanceAncestor.has(target);
}

