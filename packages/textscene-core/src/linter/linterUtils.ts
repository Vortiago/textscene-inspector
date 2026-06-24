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
 * Collect every node named `name` anywhere in the scene tree (depth-first).
 * The NodePath-target linters resolve a path's final segment by name; collecting
 * ALL matches (rather than the first) lets them detect the ambiguous case —
 * Godot allows node names to repeat across different parents, and the static
 * linter cannot tell which one a path means without full relative resolution.
 */
export function findNodesByName(nodes: TscnNode[], name: string, out: TscnNode[] = []): TscnNode[] {
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
