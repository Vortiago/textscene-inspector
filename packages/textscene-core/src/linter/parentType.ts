/** Shared parent-type resolution for the semantic linters. */

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
   * opens, and a node with no `type` at all inherits one the same way.
   */
  | { kind: 'unknowable' }
  /** A real, typed parent that is not the wanted type. */
  | { kind: 'mismatch'; parent: TscnNode };

/**
 * Resolve `node`'s parent against `wantedType`, subclasses included.
 *
 * The instanced/untyped exemption is the reason this exists. It was written
 * out by hand at four call sites — `XRCamera3D`, `OpenXRVisibilityMask` and
 * both arms of `BoneAttachment3D` — byte-identical each time, and it had
 * already drifted in FORM between them (`parent && (parent.instance || !parent.type)`
 * versus a standalone `parent.instance || !parent.type` leaning on an earlier
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
  if (parent.instance || !parent.type) return { kind: 'unknowable' };
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
