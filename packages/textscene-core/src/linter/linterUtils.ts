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
 * Find the parent of `target` in the node tree, or null when it is a root (no
 * parent) or absent. Shared by the linters that validate parent type — e.g.
 * CollisionShape2D/3D (must sit under a physics body) and PathFollow2D/3D (must
 * sit under a Path2D/Path3D).
 */
export function findParentNode(
  nodes: TscnNode[],
  target: TscnNode,
  parent: TscnNode | null = null
): TscnNode | null {
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
 * Recursively find the first node named `name` anywhere in the scene tree, or
 * null. The NodePath-target linters (MeshInstance3D skeleton, GPUParticles3D
 * sub-emitter, AnimationTree anim_player) resolve a path's final segment to a
 * concrete node by name before checking its type.
 */
export function findNodeByName(nodes: TscnNode[], name: string): TscnNode | null {
  for (const node of nodes) {
    if (node.name === name) return node;
    const found = findNodeByName(node.children, name);
    if (found) return found;
  }
  return null;
}

/**
 * True when `target` has an ancestor that is an instanced sub-scene (`instance=`).
 * Such a node's NodePath references can resolve into sub-scene internals the
 * static linter never sees, so not-found / wrong-type assertions are unsafe.
 * The "an ancestor was an instance" flag is carried down the walk, so the answer
 * is found without materializing any ancestor arrays.
 */
export function isUnderInstance(roots: TscnNode[], target: TscnNode, ancestorIsInstance = false): boolean {
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
