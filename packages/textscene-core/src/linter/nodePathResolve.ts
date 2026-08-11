/**
 * `Node::get_node_or_null` (node.cpp:1892-1952), ported over the AUTHORED tree.
 *
 * Every NodePath rule needs the same question answered — does this path name a
 * node, and which one — and answering it by matching the path's final segment
 * against every name in the scene was wrong in both directions. Godot does not
 * search: it WALKS, one segment at a time, from the referencing node:
 *
 *     if (!p_path.is_absolute()) { current = const_cast<Node *>(this); }   // :1903-1904
 *     ...
 *     } else if (name.is_node_unique_name()) {                            // :1930
 *         Node **unique = current->data.owned_unique_nodes.getptr(name);
 *         if (!unique && current->data.owner) {
 *             unique = current->data.owner->data.owned_unique_nodes.getptr(name);
 *         }
 *         if (!unique) { return nullptr; }
 *         next = *unique;
 *     } else {
 *         const Node *const *node = current->data.children.getptr(name);   // :1941
 *         if (node) { next = const_cast<Node *>(*node); } else { return nullptr; }
 *     }
 *
 * `data.children.getptr(name)` is the referencing node's OWN children, so a bare
 * `"Body"` never reaches a sibling, an ancestor, or an unrelated branch that
 * happens to share the name. A name-anywhere match therefore stayed silent on a
 * genuinely dangling path and, for `%Unique`, reported a working one as missing.
 *
 * ## Where a static reader must decline
 *
 * Three things this file cannot see, and all yield `unknowable` rather than a
 * guess. Walking INTO a node `isTypeUnknowable` covers: its interior children
 * live in another file, so a name that misses among the authored ones may still
 * exist. Walking FROM a node that sits under an instance: the enclosing
 * sub-scene can add siblings and parents this file never lists. And landing ON
 * one: the heading declares a name and a PackedScene, never a class, so every
 * caller that asks `descendsFrom(target.node.type, …)` reads a non-class as a
 * class name and reports a Godot-valid target as the wrong type —
 * `scenes/demos/3d/ik/fps/fps_example.tscn` relays into an instanced `.dae`
 * weapon and was warned about.
 *
 * Unique names are decidable, though. `_acquire_unique_name_in_owner`
 * (node.cpp:2222-2234) registers `"%" + name` on the node's OWNER, which for a
 * `.tscn` is the scene root, and `unique_name_in_owner` is a stored BOOL
 * (node.cpp:4050 — `PROPERTY_USAGE_NO_EDITOR` hides it from the inspector and
 * still serialises it). So the map is exactly the nodes in this file carrying
 * that flag, and a `%Name` with no such node really does resolve to null.
 */

import type { TscnNode, TscnScene } from '../parser/types.js';
import { findParentNode, isUnderInstance } from './linterUtils.js';
import { isTypeUnknowable } from './parentType.js';

/** `UNIQUE_NODE_PREFIX` (string_name.h:36). */
const UNIQUE_NODE_PREFIX = '%';

/**
 * What resolving a NodePath against the authored tree can say.
 *
 * `unknowable` is the only decline: Godot's own walk is deterministic, so there
 * is no "ambiguous" — that arm existed to paper over name-matching, and a rule
 * that reports on a guess is worse than one that stays quiet.
 */
export type NodePathResolution =
  | { readonly status: 'found'; readonly node: TscnNode }
  /** The walk ran off the authored tree exactly as the engine's would. */
  | { readonly status: 'missing' }
  /** The walk entered, started inside, or ended on content this file does not declare. */
  | { readonly status: 'unknowable' };

const UNKNOWABLE: NodePathResolution = { status: 'unknowable' };
const MISSING: NodePathResolution = { status: 'missing' };

/** `unique_name_in_owner = true` on this node (node.cpp:4050). */
function isUniqueNameInOwner(node: TscnNode): boolean {
  const props = node.properties as Record<string, unknown> | undefined;
  return props?.unique_name_in_owner === true || props?.unique_name_in_owner === 'true';
}

/** `%Name` -> the node claiming it, gathered depth-first over the whole file. */
function uniqueNameOwners(roots: TscnNode[]): Map<string, TscnNode> {
  const out = new Map<string, TscnNode>();
  const walk = (nodes: TscnNode[]): void => {
    for (const node of nodes) {
      // First claim wins, matching `_acquire_unique_name_in_owner`'s refusal to
      // overwrite an existing entry (node.cpp:2224-2231).
      const key = UNIQUE_NODE_PREFIX + node.name;
      if (isUniqueNameInOwner(node) && !out.has(key)) out.set(key, node);
      walk(node.children);
    }
  };
  walk(roots);
  return out;
}

/** The direct child named `name`, mirroring `data.children.getptr(name)`. */
function childNamed(node: TscnNode, name: string): TscnNode | undefined {
  return node.children.find((child) => child.name === name);
}

/**
 * The path's name segments, with any `:property` subname dropped.
 *
 * A NodePath's subnames address a property on the resolved node and take no part
 * in `get_node_or_null`, which loops over `get_name_count()` alone (:1912).
 */
function nameSegments(path: string): string[] {
  return path.split(':')[0]!.split('/').filter((segment) => segment !== '');
}

/**
 * Resolve `path` as written on `referencingNode`.
 *
 * Absolute paths (`/root/…`) are `unknowable`: `get_node_or_null` measures them
 * from the live SceneTree root (:1898 refuses them outside a tree), and a
 * `.tscn`'s own root is not that node — the autoloads and the main scene sit
 * above it.
 */
export function resolveNodePath(
  scene: TscnScene,
  referencingNode: TscnNode,
  path: string
): NodePathResolution {
  if (path === '') return MISSING; // `p_path.is_empty()` (:1894)
  if (path.startsWith('/')) return UNKNOWABLE;

  // No NAME segments is not an empty path: `is_empty()` is `!data`, true only
  // for a default-constructed NodePath, so `":position"` carries data, runs the
  // `get_name_count()` loop zero times (:1912) and returns `this`.
  const segments = nameSegments(path);
  if (isUnderInstance(scene.nodes, referencingNode)) return UNKNOWABLE;

  let uniques: Map<string, TscnNode> | null = null;
  let current: TscnNode = referencingNode;

  for (const name of segments) {
    if (name === '.') continue;

    if (name === '..') {
      const parent = findParentNode(scene.nodes, current);
      // `:1920-1922` returns null here, and standalone in the editor that is
      // exactly what happens. But this file's root is only the runtime root
      // while the scene is open on its own: instanced anywhere, the `..` lands
      // on a parent the file never names. Declining is the same call the
      // `instance=` cases make, and reporting instead would fire on every scene
      // built to be instanced.
      if (!parent) return UNKNOWABLE;
      current = parent;
      continue;
    }

    if (name.startsWith(UNIQUE_NODE_PREFIX)) {
      uniques ??= uniqueNameOwners(scene.nodes);
      const claimed = uniques.get(name);
      if (!claimed) return MISSING; // :1935-1937
      current = claimed;
      continue;
    }

    // Below an `instance=` node the real children are in another file, so a miss
    // here is our blindness rather than the engine's null.
    const child = childNamed(current, name);
    if (!child) return isTypeUnknowable(current) ? UNKNOWABLE : MISSING;
    current = child;
  }

  // The node exists, but nothing about it beyond its name is readable here: an
  // `instance=` heading names a PackedScene rather than a class, and a heading
  // with neither `type=` nor `instance=` overrides a node declared elsewhere.
  return isTypeUnknowable(current) ? UNKNOWABLE : { status: 'found', node: current };
}
