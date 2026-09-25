/**
 * What the semantic linters can know about a node's parent type and visibility. Both
 * meet the same limit: a node instanced, or overridden inside an instance, takes its
 * type and properties from a scene this linter never opens.
 */

import type { TscnNode } from '../parser/types.js';
import { isTypeUnknowable } from '../parser/typeUnknowable.js';
import { findParentNode } from './linterUtils.js';
import { descendsFrom, isCatalogedType } from '../godot/nodeBaseTypes.js';
import type { TscnScene } from '../parser/types.js';
import { boolSlotValue } from '../godot/index.js';

// Re-exported, not re-spelled: `buildSceneTree` asks the same question at
// every descent of a `parent=` path, and the parser cannot import the linter.
export { isTypeUnknowable };

/**
 * What a rule can say about a node's parent, once the cases it must not judge are removed.
 * `root` and `unknowable` are separate: `XRCamera3D` guards with `if (parent && origin ==
 * nullptr)` and stays silent at the root, while `OpenXRVisibilityMask` and `BoneAttachment3D`
 * warn there, so a rule chooses out loud.
 */
export type ParentVerdict =
  /**
   * The parent is, or descends from, the wanted type. It carries the node, since several
   * warnings then ask about the parent: `PathFollow3D`'s ROTATION_ORIENTED check reads the
   * parent Path3D's `curve` without a second walk.
   */
  | { kind: 'satisfied'; parent: TscnNode }
  /** No parent: this node is the scene root. */
  | { kind: 'root' }
  /**
   * The parent's type is not knowable from this file: an instanced parent's type, and an
   * override's, lives in a scene the linter never opens.
   */
  | { kind: 'unknowable' }
  /** A real, typed parent that is not the wanted type. */
  | { kind: 'mismatch'; parent: TscnNode };

/**
 * Resolve `node`'s parent against `wantedType`, subclasses included, with the unknowable
 * exemption in one place, since a hand-written copy at a call site can drop it.
 */
export function parentTypeVerdict(
  scene: TscnScene,
  node: TscnNode,
  wantedType: string
): ParentVerdict {
  const step = knownParent(scene, node);
  if (step.kind !== 'known') return step;
  const { parent } = step;
  if (descendsFrom(parent.type, wantedType)) return { kind: 'satisfied', parent };
  return { kind: 'mismatch', parent };
}

/** One step up the tree, with the knowability question already answered. */
export type ParentLookup =
  /** A parent whose `type` this file really states. */
  | { kind: 'known'; parent: TscnNode }
  /** No parent: this node is the scene root. */
  | { kind: 'root' }
  /** There is a parent, but no type this linter may reason about: declared in a scene it never opens, or outside Godot's catalog. */
  | { kind: 'unknowable' };

/**
 * `node`'s parent, or the reason no rule may reason about it: the only way out of this
 * module to a parent whose type may be read. `findParentNode` hands back the raw heading,
 * where a forgotten check is invisible. {@link parentIdentity} is the second door, for a
 * caller that reads no type.
 */
export function knownParent(scene: TscnScene, node: TscnNode): ParentLookup {
  const parent = findParentNode(scene.nodes, node);
  if (!parent) return { kind: 'root' };
  // A type goes unread two ways: declared in another scene, or outside the catalog. Godot's
  // check is a runtime `cast_to` against a ClassDB with every extension registered
  // (collision_shape_3d.cpp:125-128), and `descendsFrom` says false for "not a subclass"
  // and "never heard of it" alike.
  if (isTypeOpaque(parent)) return { kind: 'unknowable' };
  return { kind: 'known', parent };
}

/**
 * Whether this node's class is one no verdict may be drawn from, the two ways
 * {@link knownParent} declines, asked of any node. A child-side check such as
 * `hasCollisionShapeChild` needs it for a GDExtension shape provider.
 */
export function isTypeOpaque(node: TscnNode): boolean {
  return isTypeUnknowable(node) || !isCatalogedType(node.type);
}

/**
 * `node`'s parent whatever its class, or null at the root. A NodePath `..` is `get_parent()`,
 * which needs identity, never type, so a {@link knownParent} decline would stop the walk.
 * Safe only because the caller reads no `.type` off it: `resolveNodePath` gates its result
 * through {@link isTypeUnknowable}.
 */
export function parentIdentity(scene: TscnScene, node: TscnNode): TscnNode | null {
  return findParentNode(scene.nodes, node);
}

/** Where an ancestor walk stopped. */
export type AncestorSearch<T> =
  /** `visit` returned a value at some ancestor; the walk stopped there. */
  | { kind: 'found'; value: T }
  /** An ancestor the walk had to pass takes its type from another scene. */
  | { kind: 'unknowable' }
  /** The walk reached the scene root without `visit` returning anything. */
  | { kind: 'exhausted' };

/**
 * Climb `node`'s ancestors, nearest first, until `visit` returns a value. `visit` sees only
 * an ancestor whose type this file states and the catalog knows: each step goes through
 * `knownParent`, so a bare `ancestor.type` or `descendsFrom` read inside `visit` is correct.
 * An instanced, override, typeless or GDExtension ancestor ends the walk at `unknowable`.
 */
export function searchAncestors<T>(
  scene: TscnScene,
  node: TscnNode,
  visit: (ancestor: TscnNode) => T | undefined
): AncestorSearch<T> {
  // `undefined` climbs on, anything else stops, and a caller that declines returns its
  // own sentinel. Godot's walks differ too much to fold in (`Bone2D` stops at the first
  // non-Bone2D, the `clip_children` checks read to the root), so that varies in `visit`.
  let current = node;
  for (;;) {
    const step = knownParent(scene, current);
    if (step.kind === 'root') return { kind: 'exhausted' };
    if (step.kind === 'unknowable') return { kind: 'unknowable' };
    const value = visit(step.parent);
    if (value !== undefined) return { kind: 'found', value };
    current = step.parent;
  }
}

/**
 * Visit every ancestor whose type this file states, nearest first, to the root.
 * `CanvasItem::get_configuration_warnings()` (`canvas_item.cpp:1302-1320`) walks
 * `n = n->get_parent()` to the top with no type test, so an unclassifiable ancestor is
 * skipped. A chain-terminating walk declines instead, since the skipped one might end it.
 */
export function sweepAncestors(
  scene: TscnScene,
  node: TscnNode,
  visit: (ancestor: TscnNode) => void
): void {
  // A skipped ancestor can only add a hit, never withdraw one, so nothing is reported
  // about it. The engine's early exit once every warning fired (`canvas_item.cpp:1321-1325`)
  // is an optimisation with nothing observable riding on it.
  let current = findParentNode(scene.nodes, node);
  while (current) {
    if (!isTypeUnknowable(current)) visit(current);
    current = findParentNode(scene.nodes, current);
  }
}

/**
 * The parent a `satisfied` or `mismatch` verdict carries, or null. Rules ask it a second
 * question, as `CollisionPolygon2D` tests its parent for `CollisionObject2D`, then `Area2D`
 * (`collision_polygon_2d.cpp:235-254`). Safe only here, past `isTypeUnknowable`.
 */
export function verdictParent(verdict: ParentVerdict): TscnNode | null {
  return verdict.kind === 'satisfied' || verdict.kind === 'mismatch' ? verdict.parent : null;
}

/**
 * How a diagnostic names where the node sits, for a `mismatch` or `root`: Godot phrases
 * these warnings around placement, so every one needs the same clause.
 */
export function placementPhrase(verdict: ParentVerdict): string {
  return verdict.kind === 'mismatch' ? `a child of a ${verdict.parent.type} node` : 'the scene root';
}

/**
 * True when the node sets `visible = false` in this file. Godot gates several warnings on
 * `is_visible()` (`node_3d.cpp:1127-1130`), the local flag, not `is_visible_in_tree()`.
 * The cascade reads each ancestor with it too: CanvasItem (`canvas_item.cpp:1471`), Node3D
 * (`node_3d.cpp:1541`), CanvasLayer (`canvas_layer.cpp:341`) and Window (`window.cpp:3436`) spell it `visible`.
 */
export function isExplicitlyHidden(properties: Record<string, string>): boolean {
  return boolSlotValue(properties.visible) === false;
}

/**
 * What a rule can say about `is_visible_in_tree()`, computed statically. `CanvasItem` and
 * `Node3D` each declare their own over different chains, and a rule ported from a gated
 * `get_configuration_warnings()` gets its class's.
 */
export type VisibilityVerdict =
  /** Godot's `is_visible_in_tree()` would return true for this node. */
  | 'visible'
  /** The node, or an ancestor its family's chain consults, sets `visible = false`. */
  | 'hidden'
  /** An ancestor the chain consults is instanced or untyped, so its own `visible` is not in this file. */
  | 'unknowable';

/** `isExplicitlyHidden` over a node, since `properties` is widened per node type. */
function ownVisibleKeyIsFalse(node: TscnNode): boolean {
  return isExplicitlyHidden(node.properties as unknown as Record<string, string>);
}

/**
 * `Node3D::is_visible_in_tree()` (`node_3d.cpp:1131-1143`) walks `s = s->data.parent`, and
 * `data.parent` is `cast_to<Node3D>(get_parent())` (`node_3d.cpp:150`), so the chain is the
 * contiguous Node3D run, and the first non-Node3D ancestor ends it.
 */
function node3DCascade(scene: TscnScene, node: TscnNode): VisibilityVerdict {
  let current = findParentNode(scene.nodes, node);
  while (current) {
    if (isTypeUnknowable(current)) return 'unknowable';
    // `descendsFrom` is false for two unrelated reasons, and only one of them
    // ends the chain: a GDExtension class this build has never heard of may
    // well be a Node3D. `parentTypeVerdict` guards the same case.
    if (!isCatalogedType(current.type)) return 'unknowable';
    if (!descendsFrom(current.type, 'Node3D')) return 'visible';
    if (ownVisibleKeyIsFalse(current)) return 'hidden';
    current = findParentNode(scene.nodes, current);
  }
  return 'visible';
}

/**
 * `CanvasItem::is_visible_in_tree()` (`canvas_item.cpp:62-64`: `visible && parent_visible_in_tree`).
 * `NOTIFICATION_ENTER_TREE` (`canvas_item.cpp:306-352`) sets the parent half from the immediate
 * parent: a CanvasItem's own `is_visible_in_tree()`, so the run cascades, else a CanvasLayer's
 * `cl->is_visible()` (`canvas_layer.cpp:75`), else the first Viewport ancestor.
 */
function canvasItemCascade(scene: TscnScene, node: TscnNode): VisibilityVerdict {
  let current = findParentNode(scene.nodes, node);
  while (current) {
    if (isTypeUnknowable(current)) return 'unknowable';
    // See `node3DCascade`: an uncataloged ancestor may be a CanvasItem.
    if (!isCatalogedType(current.type)) return 'unknowable';
    if (!descendsFrom(current.type, 'CanvasItem')) break;
    if (ownVisibleKeyIsFalse(current)) return 'hidden';
    current = findParentNode(scene.nodes, current);
  }
  if (!current) return 'visible';

  // The layer's own key only: the chain ends there.
  if (descendsFrom(current.type, 'CanvasLayer')) {
    return ownVisibleKeyIsFalse(current) ? 'hidden' : 'visible';
  }

  // The Viewport search starts at that same parent and skips whatever is not a Viewport,
  // so an unknowable ancestor still matters. A Window gives `window->is_visible()`
  // (`window.cpp:1166-1169`), any other Viewport `true`, and a saved scene's root has none.
  while (current) {
    if (isTypeUnknowable(current)) return 'unknowable';
    // Same reason the CanvasItem run declines on one: `descendsFrom` is false
    // for "not a Window" and for "never heard of it" alike, and a GDExtension
    // class in this position may well be a Window whose own `visible` decides.
    if (!isCatalogedType(current.type)) return 'unknowable';
    if (descendsFrom(current.type, 'Window')) {
      return ownVisibleKeyIsFalse(current) ? 'hidden' : 'visible';
    }
    if (descendsFrom(current.type, 'Viewport')) return 'visible';
    current = findParentNode(scene.nodes, current);
  }
  return 'visible';
}

/**
 * Godot's `is_visible_in_tree()` for `node`, from this file alone. Only an explicit
 * `visible = false` hides, never a class default: `Popup` (`popup.cpp:218`) and
 * `AcceptDialog` (`dialogs.cpp:466`) `set_visible(false)` in their constructors, and
 * resolving absence would silence every warning under one.
 */
export function visibleInTreeVerdict(scene: TscnScene, node: TscnNode): VisibilityVerdict {
  if (ownVisibleKeyIsFalse(node)) return 'hidden';
  if (descendsFrom(node.type, 'CanvasItem')) return canvasItemCascade(scene, node);
  if (descendsFrom(node.type, 'Node3D')) return node3DCascade(scene, node);
  // Neither family: no `is_visible_in_tree()` and no gated warning to suppress.
  return 'visible';
}

/**
 * True when a warning Godot gates on `is_visible_in_tree()` must stay silent, on
 * `unknowable` too: a guess would report a misconfiguration the author cannot see here.
 */
export function hiddenOrUnknowableInTree(scene: TscnScene, node: TscnNode): boolean {
  return visibleInTreeVerdict(scene, node) !== 'visible';
}
