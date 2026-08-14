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
 * linter report a misplaced skeleton modifier on a shipped Godot demo, where a
 * `PhysicalBoneSimulator3D` hangs off a `Skeleton3D` override inside an
 * instanced character.
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
  /** There is a parent, but its type lives in a scene this linter never opens. */
  | { kind: 'unknowable' };

/**
 * `node`'s parent, or the reason no rule may reason about it.
 *
 * The narrow primitive behind everything else here, and the only way out of
 * this module to a parent whose TYPE may be read. `findParentNode` hands back
 * the raw heading, type and all, and a caller holding one has to remember a
 * check that is invisible when forgotten — which is how three rules came to
 * warn about parents declared in another file. This one cannot be held without
 * the answer. {@link parentIdentity} is the second door, for the caller that
 * reads no type at all.
 */
export function knownParent(scene: TscnScene, node: TscnNode): ParentLookup {
  const parent = findParentNode(scene.nodes, node);
  if (!parent) return { kind: 'root' };
  if (isTypeUnknowable(parent)) return { kind: 'unknowable' };
  return { kind: 'known', parent };
}

/**
 * `node`'s parent whatever its class, or null at this file's root.
 *
 * The second and last way out of this module, for the one question
 * {@link knownParent} cannot answer: a NodePath `..` is `get_parent()`, so it
 * needs the parent's IDENTITY and never its type. Declining on an instanced or
 * override parent stops the walk on a node the file names perfectly well, and
 * silences every rule that would have judged where the path finally lands.
 * Safe only because the caller reads no `.type` off this: `resolveNodePath`
 * gates its own result through {@link isTypeUnknowable} before handing a node
 * back.
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
 * Climb `node`'s ancestors, nearest first, until `visit` returns a value.
 *
 * `visit` is called ONLY with an ancestor whose type this file states: every
 * step goes through `knownParent`, so an instanced, override or typeless
 * ancestor ends the walk at `unknowable` before `visit` ever sees it. That
 * contract is what makes a bare `ancestor.type` read inside `visit` correct —
 * the check is in the walk, once, instead of at each caller's discretion.
 *
 * A caller that wants to keep climbing returns `undefined`; a caller that wants
 * to stop returns anything else, and one that also wants to decline the whole
 * question returns its own sentinel and maps it. Godot's own walks differ too
 * much to fold into the primitive — `Bone2D` stops at the first non-Bone2D
 * ancestor while the `clip_children` checks read every ancestor to the root —
 * so what varies stays in `visit` and what must not vary stays here.
 */
export function searchAncestors<T>(
  scene: TscnScene,
  node: TscnNode,
  visit: (ancestor: TscnNode) => T | undefined
): AncestorSearch<T> {
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
 *
 * The difference from `searchAncestors` is Godot's, not a convenience.
 * `CanvasItem::get_configuration_warnings()` (`canvas_item.cpp:1302-1320`)
 * walks `n = n->get_parent()` to the top and never consults a type to decide
 * whether to CONTINUE, so an ancestor this file cannot classify subtracts
 * nothing: a clipping ancestor found above one is still that node's ancestor at
 * runtime. A chain-terminating walk cannot skip an ancestor that way, because
 * the one it skipped might have been the terminator, which is why that shape
 * declines with `unknowable` instead.
 *
 * Nothing is reported about what was skipped, deliberately: a skipped ancestor
 * can only ADD a hit, never withdraw one, so a caller that found a hit is still
 * right and a caller that found none stays silent either way.
 *
 * The engine breaks out early once every warning it can raise has fired
 * (`canvas_item.cpp:1321-1325`); that is an optimisation over a handful of
 * ancestors, with nothing observable riding on it.
 */
export function sweepAncestors(
  scene: TscnScene,
  node: TscnNode,
  visit: (ancestor: TscnNode) => void
): void {
  let current = findParentNode(scene.nodes, node);
  while (current) {
    if (!isTypeUnknowable(current)) visit(current);
    current = findParentNode(scene.nodes, current);
  }
}

/**
 * The parent a verdict resolved to, or null when it named none.
 *
 * `satisfied` and `mismatch` both carry one, and several rules ask a second
 * question of the same parent — Godot's own checks routinely do, the way
 * `CollisionPolygon2D` tests its parent for `CollisionObject2D` and then again
 * for `Area2D` (`collision_polygon_2d.cpp:235-254`). Handing back the node is
 * safe here and only here: this one is already past `isTypeUnknowable`.
 */
export function verdictParent(verdict: ParentVerdict): TscnNode | null {
  return verdict.kind === 'satisfied' || verdict.kind === 'mismatch' ? verdict.parent : null;
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
 *
 * It is also the primitive `visibleInTreeVerdict` reads each ancestor with —
 * every class the cascade consults spells the key `visible`, CanvasItem
 * (`canvas_item.cpp:1471`), Node3D (`node_3d.cpp:1541`), CanvasLayer
 * (`canvas_layer.cpp:341`) and Window (`window.cpp:3436`) alike.
 */
export function isExplicitlyHidden(properties: Record<string, string>): boolean {
  return properties.visible === 'false';
}

/**
 * What a rule can say about `is_visible_in_tree()`, computed statically.
 *
 * There is no single such method: `CanvasItem` and `Node3D` declare their own,
 * over different chains, and a rule ported from a gated
 * `get_configuration_warnings()` gets whichever its class inherits.
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
 * `Node3D::is_visible_in_tree()` (`node_3d.cpp:1131-1143`): walks
 * `s = s->data.parent`, and `data.parent` is `cast_to<Node3D>(get_parent())`
 * (`node_3d.cpp:150`). The cast yields null for anything else, so the chain is
 * the contiguous run of Node3D ancestors and the first non-Node3D ancestor ends
 * it — everything above is never consulted, hidden or not.
 */
function node3DCascade(scene: TscnScene, node: TscnNode): VisibilityVerdict {
  let current = findParentNode(scene.nodes, node);
  while (current) {
    if (isTypeUnknowable(current)) return 'unknowable';
    if (!descendsFrom(current.type, 'Node3D')) return 'visible';
    if (ownVisibleKeyIsFalse(current)) return 'hidden';
    current = findParentNode(scene.nodes, current);
  }
  return 'visible';
}

/**
 * `CanvasItem::is_visible_in_tree()` (`canvas_item.cpp:62-64`:
 * `visible && parent_visible_in_tree`), where `parent_visible_in_tree` is fixed
 * at `NOTIFICATION_ENTER_TREE` (`canvas_item.cpp:306-352`) by the IMMEDIATE
 * parent, in three exclusive branches:
 *
 * - a CanvasItem parent contributes its own `is_visible_in_tree()`, so the
 *   contiguous CanvasItem run cascades;
 * - else a CanvasLayer parent contributes `cl->is_visible()`
 *   (`canvas_layer.cpp:75`) — its OWN key only, and the chain ends there, so a
 *   CanvasLayer one hop further up contributes nothing;
 * - else the search climbs to the first Viewport ancestor: a Window gives
 *   `window->is_visible()` (`window.cpp:1166-1169`), any other Viewport gives
 *   `true`, and no Viewport at all leaves it alone. A saved scene's root has no
 *   Viewport in the file, so its own key is all that decides.
 */
function canvasItemCascade(scene: TscnScene, node: TscnNode): VisibilityVerdict {
  let current = findParentNode(scene.nodes, node);
  while (current) {
    if (isTypeUnknowable(current)) return 'unknowable';
    if (!descendsFrom(current.type, 'CanvasItem')) break;
    if (ownVisibleKeyIsFalse(current)) return 'hidden';
    current = findParentNode(scene.nodes, current);
  }
  if (!current) return 'visible';

  if (descendsFrom(current.type, 'CanvasLayer')) {
    return ownVisibleKeyIsFalse(current) ? 'hidden' : 'visible';
  }

  // The Viewport search starts at that same parent and skips whatever is not a
  // Viewport, so an unknowable ancestor here still matters: it could be a Window.
  while (current) {
    if (isTypeUnknowable(current)) return 'unknowable';
    if (descendsFrom(current.type, 'Window')) {
      return ownVisibleKeyIsFalse(current) ? 'hidden' : 'visible';
    }
    if (descendsFrom(current.type, 'Viewport')) return 'visible';
    current = findParentNode(scene.nodes, current);
  }
  return 'visible';
}

/**
 * Godot's `is_visible_in_tree()` for `node`, read off this file alone.
 *
 * Only an explicit `visible = false` hides: absence is Godot's default form and
 * the linter never resolves it against a class default. That is load-bearing
 * for the Window branch, where the default is not `true` — `Popup`
 * (`popup.cpp:218`) and `AcceptDialog` (`dialogs.cpp:466`) both `set_visible(false)`
 * in their constructor, so a dialog that is shown writes `visible = true` and a
 * dialog that omits the key is hidden at runtime. Resolving absence would
 * silence every warning under one.
 *
 * A node in neither family has no `is_visible_in_tree()` to reproduce, and no
 * gated configuration warning either, so nothing is suppressed.
 */
export function visibleInTreeVerdict(scene: TscnScene, node: TscnNode): VisibilityVerdict {
  if (ownVisibleKeyIsFalse(node)) return 'hidden';
  if (descendsFrom(node.type, 'CanvasItem')) return canvasItemCascade(scene, node);
  if (descendsFrom(node.type, 'Node3D')) return node3DCascade(scene, node);
  return 'visible';
}

/**
 * True when a warning Godot gates on `is_visible_in_tree()` must stay silent.
 *
 * The three ported gates collapse the verdict identically, and each had to pick
 * the same side of `unknowable`: a rule that guessed there would report a
 * misconfiguration the author cannot see from this file.
 */
export function hiddenOrUnknowableInTree(scene: TscnScene, node: TscnNode): boolean {
  return visibleInTreeVerdict(scene, node) !== 'visible';
}
