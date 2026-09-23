/** Small shared helpers for node-type semantic linters. */

import type { TscnNode } from '../parser/types.js';
import { nodePathLiteral } from '../godot/index.js';
import { cachedUniqueNameClaims, type uniqueNameClaims } from '../utils/uniqueNames.js';

/**
 * Narrow a node's `properties` to a string-keyed record before reading raw
 * values in a semantic rule.
 */
export function isValidProperties(props: unknown): props is Record<string, string> {
  return typeof props === 'object' && props !== null;
}

/**
 * Scene-tree facts built in one depth-first pass for the helpers below. A rule calls
 * them once per matching node, so a walk per call would cost O(N^2). The first lookup
 * against a tree pays one O(N) walk, and each later one is O(1) or O(matches).
 */
interface SceneIndex {
  /** node -> its parent, or `null` for a root. Absent key = node not in this tree. */
  parentOf: Map<TscnNode, TscnNode | null>;
  /** name -> every node with that name, in depth-first order. */
  byName: Map<string, TscnNode[]>;
  /** Nodes that have an ancestor (not themselves) with `instance` set. */
  underInstanceAncestor: Set<TscnNode>;
  /**
   * type -> every node of that type, in depth-first (Godot tree) order. A list, not a
   * count and a first node, because a conditional `add_to_group` lookup needs the first
   * entry that satisfies a predicate, at O(nodes of that type).
   */
  nodesByType: Map<string, TscnNode[]>;
}

/**
 * Keyed by the roots array's identity, written only by `getSceneIndex`. A parsed
 * `scene.nodes` is never mutated in place and each parse makes a fresh array, so an
 * entry never goes stale and is collected with its tree. A caller that mutated a tree
 * in place and re-queried the same array would read stale results.
 */
const sceneIndexCache = new WeakMap<TscnNode[], SceneIndex>();

function buildSceneIndex(roots: TscnNode[]): SceneIndex {
  const parentOf = new Map<TscnNode, TscnNode | null>();
  const byName = new Map<string, TscnNode[]>();
  const underInstanceAncestor = new Set<TscnNode>();
  const nodesByType = new Map<string, TscnNode[]>();

  const walk = (nodes: TscnNode[], parent: TscnNode | null, ancestorIsInstance: boolean): void => {
    for (const node of nodes) {
      parentOf.set(node, parent);

      const named = byName.get(node.name);
      if (named) named.push(node);
      else byName.set(node.name, [node]);

      const ofType = nodesByType.get(node.type);
      if (ofType) ofType.push(node);
      else nodesByType.set(node.type, [node]);

      if (ancestorIsInstance) underInstanceAncestor.add(node);

      walk(node.children, node, ancestorIsInstance || Boolean(node.instance));
    }
  };
  walk(roots, null, false);

  // Freeze each bucket: `findNodesByName` and `nodesOfType` hand these arrays
  // straight to callers with no per-call copy, matching `RuleRegistry`'s hot-path
  // contract, and the freeze enforces it.
  for (const matches of byName.values()) Object.freeze(matches);
  for (const ofType of nodesByType.values()) Object.freeze(ofType);

  return { parentOf, byName, underInstanceAncestor, nodesByType };
}

/**
 * The `%Name` claim table, built once per tree and shared with the render
 * path's consumers through the cache in `utils/uniqueNames.ts`. Lazy rather
 * than a `SceneIndex` field, because most scenes carry no `%Name` path at all.
 */
export function sceneUniqueClaims(roots: TscnNode[]): ReturnType<typeof uniqueNameClaims> {
  return cachedUniqueNameClaims(roots);
}

function getSceneIndex(roots: TscnNode[]): SceneIndex {
  let index = sceneIndexCache.get(roots);
  if (!index) {
    index = buildSceneIndex(roots);
    sceneIndexCache.set(roots, index);
  }
  return index;
}

/** Shared empty result for a type or name miss: one frozen instance, not an allocation per miss. */
const NO_MATCHES: readonly TscnNode[] = Object.freeze([]);

/**
 * Every node of `type`, in depth-first (Godot tree) order, frozen, not copied. A rule
 * walking the tree in `check` for an "only the first has an effect" warning costs
 * O(matches x nodes); this, {@link countNodesOfType} and {@link firstNodeOfType} read the
 * cached index. Exact-name: Godot compares `get_class()` or scans a type-keyed group.
 */
export function nodesOfType(roots: TscnNode[], type: string): readonly TscnNode[] {
  return getSceneIndex(roots).nodesByType.get(type) ?? NO_MATCHES;
}

/** How many nodes of `type` the scene contains, off the same cached index. */
export function countNodesOfType(roots: TscnNode[], type: string): number {
  return nodesOfType(roots, type).length;
}

/**
 * The first node of `type` in depth-first order, the one `SceneTree::get_first_node_in_group`
 * returns: `_update_group_order` (`scene_tree.cpp:333-347`) sorts by `Node::Comparator`
 * (`node.h:132-134`), tree order. Exact-name, like `countNodesOfType`, since groups are
 * keyed by concrete class.
 */
export function firstNodeOfType(
  roots: TscnNode[],
  type: string,
  joins?: (node: TscnNode) => boolean
): TscnNode | null {
  const ofType = getSceneIndex(roots).nodesByType.get(type);
  if (!ofType) return null;
  // `joins` keeps the nodes that enter the group: `WorldEnvironment` joins only
  // `if (environment.is_valid())` (world_environment.cpp:39-40). It scans this type's
  // cached nodes, where a tree walk would be quadratic when the type repeats.
  return (joins ? ofType.find(joins) : ofType[0]) ?? null;
}

/**
 * The parent of `target`, or null for a root or an absent node, in O(1) from the
 * cached index. Outside tests only `parentType.ts` calls it, and every rule asks `parentType.ts`.
 */
export function findParentNode(nodes: TscnNode[], target: TscnNode): TscnNode | null {
  return getSceneIndex(nodes).parentOf.get(target) ?? null;
}

/**
 * Extract the inner path from a `NodePath("...")` literal, or null when `value`
 * is not a NodePath literal or wraps an empty path. Shared by the NodePath-target
 * linters that resolve a node reference before checking its type.
 */
export function extractNodePath(value: string): string | null {
  // Stricter than `nodePathLiteral` on one point only: an empty path is "no
  // path" to a rule resolving a reference, where a display formatter still has
  // an empty string to show.
  return nodePathLiteral(value) || null;
}

/**
 * Every node named `name` anywhere in the scene, depth-first, since Godot allows a
 * name to repeat across parents. It returns the cached index's frozen array, not a
 * per-call copy, matching `RuleRegistry.getRulesForNodeType`'s hot-path contract.
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

