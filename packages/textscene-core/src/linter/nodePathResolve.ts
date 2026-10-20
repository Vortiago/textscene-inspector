/**
 * `Node::get_node_or_null` (node.cpp:1892-1952), ported over the authored tree. Godot
 * walks one segment at a time from the referencing node (:1903-1904), and a plain name
 * reads `current->data.children.getptr(name)` (:1941), that node's own children, so a
 * bare `"Body"` never reaches a sibling, an ancestor or an unrelated branch.
 */

import { isUnderInstance } from './linterUtils.js';
import { isTypeUnknowable, parentIdentity } from './parentType.js';
import { UNIQUE_NODE_PREFIX, nodePathWalkNames } from '../godot/string/nodePath.js';
import type { NodePathResolution, RawNode, RawScene } from '../parser/types.js';
import { MISSING, UNKNOWABLE, sceneSeating } from '../parser/sceneTreeBuilder.js';

/** The direct child named `name`, mirroring `data.children.getptr(name)`. */
function childNamed(node: RawNode, name: string): RawNode | undefined {
  return node.children.find((child) => child.name === name);
}

/**
 * Resolve `path` as written on `referencingNode`.
 *
 * Absolute paths (`/root/…`) are `unknowable`: `get_node_or_null` measures them
 * from the live SceneTree root (:1898 refuses them outside a tree), and the
 * autoloads and the main scene sit above a `.tscn`'s own root.
 */
export function resolveNodePath(scene: RawScene, referencingNode: RawNode, path: string): NodePathResolution {
  if (path === '') return MISSING; // `p_path.is_empty()` (:1894)
  if (path.startsWith('/')) return UNKNOWABLE;

  // No name segments is not an empty path: `is_empty()` is `!data`, true only
  // for a default-constructed NodePath, so `":position"` carries data, runs the
  // `get_name_count()` loop zero times (:1912) and returns `this`.
  const segments = nodePathWalkNames(path);
  // Under an instance, the enclosing sub-scene can add siblings and parents this
  // file never lists.
  if (isUnderInstance(scene.nodes, referencingNode)) return UNKNOWABLE;

  let current: RawNode = referencingNode;

  for (const name of segments) {
    if (name === '.') continue;

    if (name === '..') {
      // `:1920-1922` returns null at the root, but this file's root is the runtime
      // root only while the scene is open on its own. Instanced, the `..` lands on
      // a parent the file never names, so the root declines as unknowable.
      const parent = parentIdentity(scene, current);
      if (!parent) return UNKNOWABLE;
      // By identity, not type: the walk's end still passes `isTypeUnknowable`.
      current = parent;
      continue;
    }

    if (name.startsWith(UNIQUE_NODE_PREFIX)) {
      // The reached node's `owned_unique_nodes` is read before the owner's table
      // (`node.cpp:1930-1933`), so a sub-scene root's claims from another file win.
      // At an opaque node, a miss may be a name that file claims, and a hit may be
      // shadowed by one (:1935-1937).
      if (isTypeUnknowable(current)) return UNKNOWABLE;
      // A reached node that is not opaque owns no table of its own, so the walk reads its
      // owner's: the root's, which the seating holds in declaration order.
      const claimed = sceneSeating(scene.nodes).resolve(name);
      if (claimed.status !== 'found') return claimed;
      current = claimed.node;
      continue;
    }

    // Below an `instance=` node the real children are in another file, so a miss
    // here is this reader's blindness, not the engine's null.
    const child = childNamed(current, name);
    if (!child) return isTypeUnknowable(current) ? UNKNOWABLE : MISSING;
    current = child;
  }

  // An `instance=` heading names a PackedScene, not a class, and a heading with
  // neither `type=` nor `instance=` overrides a node declared elsewhere, so a
  // caller's `descendsFromClass(target.node.type, …)` would read a non-class.
  return isTypeUnknowable(current) ? UNKNOWABLE : { status: 'found', node: current };
}
