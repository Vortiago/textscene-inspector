/**
 * What the semantic linters can and cannot know about a node's neighbours in
 * the tree: its parent's type, and whether it is visible.
 *
 * Both answers run into the same wall, which is why they share a module:
 * a `.tscn` describes only its own nodes, and a node that comes from somewhere
 * else — instanced, or an override of one inside an instance — takes its type
 * and its properties from a scene this linter never opens.
 */

import type { TscnNode } from '../parser/types.js';
import { findParentNode } from './linterUtils.js';
import { descendsFrom } from './nodeBaseTypes.js';
import type { TscnScene } from '../parser/types.js';

/**
 * What a rule can say about a node's parent, once the cases it must not judge
 * are taken off the table.
 *
 * `root` and `unknowable` are separate on purpose. Godot's own configuration
 * warnings disagree about the parentless case — `XRCamera3D` guards with
 * `if (parent && origin == nullptr)` and so stays silent at the root, while
 * `OpenXRVisibilityMask` and `BoneAttachment3D` warn there — so a rule has to
 * choose, and a union makes it choose out loud.
 */
export type ParentVerdict =
  /**
   * The parent is, or descends from, the wanted type.
   *
   * It carries the node because several of Godot's warnings are not about
   * placement at all once placement is right — they ask something about the
   * parent. `PathFollow3D`'s ROTATION_ORIENTED check reads the parent Path3D's
   * `curve`, and re-running `findParentNode` to get it would walk the tree a
   * second time for a node this verdict already had in hand.
   */
  | { kind: 'satisfied'; parent: TscnNode }
  /** No parent: this node is the scene root. */
  | { kind: 'root' }
  /**
   * The parent's type is not knowable from this file. An instanced parent's
   * type lives in the scene it was instanced from, which the linter never
   * opens, and a node that only OVERRIDES one already at its path inherits its
   * type the same way.
   */
  | { kind: 'unknowable' }
  /** A real, typed parent that is not the wanted type. */
  | { kind: 'mismatch'; parent: TscnNode };

/**
 * True when this node's `type` is not what it says, because the node comes from
 * a scene the linter never opens.
 *
 * Three ways that happens, and testing fewer than all three is a bug that reads
 * as correct:
 *
 * - `instance=` — the node IS another scene, whose root type lives there.
 * - no `type=` and no `instance=` — Godot's marker for "override the node
 *   already at this path", inside an instanced ancestor.
 * - a genuinely absent type on a malformed heading.
 *
 * The middle case is the trap. `NodeRegistry.ts:109` defaults a missing type to
 * `'Node'`, so an override heading parses as a confident, wrong `'Node'` and a
 * check of `!node.type` sails past it. That is not hypothetical: it made the
 * linter report a misplaced skeleton modifier in Godot's own shipped ragdoll
 * demo, whose `PhysicalBoneSimulator3D` hangs off a `Skeleton3D` override
 * inside an instanced character.
 *
 * This is a function rather than three inline conditions because the inline
 * form had already been written five ways across the linter — parent-side and
 * child-side, some testing two arms, some one, one testing none — and fixing
 * the middle case in `parentTypeVerdict` did not fix it in
 * `visibleInTreeVerdict` sixty lines below, in the same commit.
 */
export function isTypeUnknowable(node: TscnNode): boolean {
  return Boolean(node.instance) || !node.type || Boolean(node.overridesExistingNode);
}

/**
 * Resolve `node`'s parent against `wantedType`, subclasses included.
 *
 * The exemption is the reason this exists. It was written out by hand at four
 * call sites — `XRCamera3D`, `OpenXRVisibilityMask` and both arms of
 * `BoneAttachment3D` — byte-identical each time, and it had already drifted in
 * FORM between them (`parent && (parent.instance || !parent.type)` versus a
 * standalone `parent.instance || !parent.type` leaning on an earlier
 * `if (!parent)`). Two spellings of one rule is how the fifth copy silently
 * drops it and starts warning about parents it cannot see.
 */
export function parentTypeVerdict(
  scene: TscnScene,
  node: TscnNode,
  wantedType: string
): ParentVerdict {
  const parent = findParentNode(scene.nodes, node);
  if (!parent) return { kind: 'root' };
  if (isTypeUnknowable(parent)) return { kind: 'unknowable' };
  if (descendsFrom(parent.type, wantedType)) return { kind: 'satisfied', parent };
  return { kind: 'mismatch', parent };
}

/**
 * How a diagnostic should name where the node sits, for a `mismatch` or `root`.
 *
 * Godot phrases these warnings around placement, so every one of them needs the
 * same clause and each had spelled it out identically.
 */
export function placementPhrase(verdict: ParentVerdict): string {
  return verdict.kind === 'mismatch' ? `a child of a ${verdict.parent.type} node` : 'the scene root';
}

/**
 * True when the node sets `visible = false` in this file.
 *
 * Godot gates several configuration warnings on `is_visible()`
 * (`node_3d.cpp:1127-1130`), so an explicitly hidden node never reaches its own
 * check. This deliberately reads only the node's OWN key: `is_visible()` is the
 * local flag, not `is_visible_in_tree()`, so an ancestor's visibility does not
 * enter into it.
 */
export function isExplicitlyHidden(properties: Record<string, string>): boolean {
  return properties.visible === 'false';
}

/**
 * What a rule can say about `CanvasItem::is_visible_in_tree()`
 * (`canvas_item.cpp:62-64`: `visible && parent_visible_in_tree`), computed
 * statically.
 *
 * `parent_visible_in_tree` cascades down from the nearest CanvasItem ancestor's
 * own `is_visible_in_tree()`, or a `CanvasLayer`'s own `is_visible()`
 * (`canvas_item.cpp:315,328`) — both are just the ancestor's own `visible` key,
 * which `CanvasLayer` exposes too (`canvas_layer.cpp:341`). So one uniform walk
 * of every ancestor's OWN `visible` key, ANDed together, reproduces the whole
 * cascade: the result is hidden the moment any one of them is explicitly
 * `false`, and visible only if none of them are.
 */
export type VisibilityVerdict =
  /** Neither the node nor any ancestor is explicitly `visible = false`. */
  | 'visible'
  /** The node, or some ancestor, sets `visible = false`. */
  | 'hidden'
  /** An ancestor's type — and so its own visibility — is not knowable from this file. */
  | 'unknowable';

/**
 * Walks from `node` up to the root. An `instance=`/untyped ancestor could be
 * hidden from a scene this linter never opens, so the walk stops there and
 * reports `unknowable` rather than assuming visible.
 */
export function visibleInTreeVerdict(scene: TscnScene, node: TscnNode): VisibilityVerdict {
  if (isExplicitlyHidden(node.properties as unknown as Record<string, string>)) return 'hidden';

  let current = findParentNode(scene.nodes, node);
  while (current) {
    if (isTypeUnknowable(current)) return 'unknowable';
    if (isExplicitlyHidden(current.properties as unknown as Record<string, string>)) return 'hidden';
    current = findParentNode(scene.nodes, current);
  }
  return 'visible';
}
