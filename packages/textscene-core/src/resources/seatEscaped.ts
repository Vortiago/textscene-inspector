/**
 * Seats the host children that the instances of one tree could not seat inside themselves. The file
 * that wrote a child walks its `parent=` from the file root (packed_scene.cpp:157-165): a walk that left
 * an instance seats the child where it ends, and a walk that found nothing re-roots it (:207-215).
 * A tree is a file root or a merged instance, and an instance passes on what leaves it.
 */

import type { SceneScope } from '../parser/types';
import { hostChildOf, scopeOf, type EscapedChild, type LiveNode } from './liveNode';
import { graftAt, placementKey } from './graftInstanceChildren';
import {
  endAboveRoot,
  nodeAt,
  OUTSIDE,
  replacedAt,
  subPathSegments,
  type ClaimedPath,
} from './instanceNameTable';
import { reRootedName } from '../godot/scene/packedScene';
import { simplifiedNodePath } from '../godot/string/nodePath';
import { addAtIndex, insertAtIndex } from '../godot/scene/siblingIndex';
import { joinPath, SCENE_ROOT_PATH } from '../utils/nodePath';
import { perObject } from '../utils/perObject';

/** Collapses an instance node in the scope of its group, or returns the node where its scene is not cached. */
export type CollapseInstance = (node: LiveNode, scope: SceneScope) => LiveNode;

/** One tree whose instances are seated. */
interface Frame {
  readonly root: LiveNode;
  /** The scope the root's children resolve their refs against. */
  readonly scope: SceneScope;
  /** The `%Name` table that answers a walk standing in this tree. */
  readonly claimed: ClaimedPath;
  /** What the root's own graft handed back: a root that inherits a base merged over it. */
  readonly handedBack: readonly EscapedChild[];
}

interface SeatedFrame {
  readonly root: LiveNode;
  /** The children that left the frame: a walk that ended above its root, or found nothing. */
  readonly escaped: readonly EscapedChild[];
}

/**
 * Whether a node below `node` states an `instanceSubPath` or a `parentContentTrail`: a host child
 * that an instance's graft may fail to seat. A tree without one takes no part in seating.
 */
export const holdsDeepChildren = perObject((node: LiveNode): boolean =>
  node.children.some(
    (child) =>
      Boolean(child.instanceSubPath) || child.parentContentTrail !== undefined || holdsDeepChildren(child)
  )
);

/** An instance node of the tree with host children that may escape it, where it sits and in which scope. */
interface Pending {
  readonly node: LiveNode;
  readonly names: readonly string[];
  readonly groupScope: SceneScope;
}

/**
 * `frame` with the children of its instances seated, and what leaves it: the file at the edge of a
 * tree re-roots what finds nothing, so it hands back no child. The root is the same object where no
 * instance hands back a child.
 *
 * @canonical Seating the host headings an instance hands back
 *   Call it where a tree's instances collapse. The live tree and the merge both do.
 */
export function seatInFile(frame: Frame, collapse: CollapseInstance): LiveNode {
  return seatFrame(frame, collapse, true).root;
}

/** `frame` with the children of its instances seated, and the children that its own instance passes on. */
export function seatInInstance(frame: Frame, collapse: CollapseInstance): SeatedFrame {
  return seatFrame(frame, collapse, false);
}

/** Whether a frame is the edge of a file decides where a child that finds nothing goes: under the root, or on. */
function seatFrame(frame: Frame, collapse: CollapseInstance, isFileRoot: boolean): SeatedFrame {
  const handedHosts = new Set(frame.handedBack.map(({ child }) => hostChildOf(child)));
  let tree = withoutHostChildren(frame.root, handedHosts).children;
  const leftovers: EscapedChild[] = [];
  const seatedHostChildren = new Set<LiveNode>();
  const done = new Set<LiveNode>();

  /** Seats `escape`, handed back by the instance at `from`, and returns the path in the frame it sits at, or null where it goes on. */
  const seat = (escape: EscapedChild, from: readonly string[]): string | null => {
    const host = hostChildOf(escape.child);
    // A child that leaves two instances in turn has bounced between them: the second walk finds nothing.
    const walkEnd = seatedHostChildren.has(host) ? null : endInFrame(escape.end, from);
    seatedHostChildren.add(host);
    const placed = walkEnd === null ? null : placeAt(tree, walkEnd, escape, frame);
    if (placed) {
      tree = placed.tree;
      return placed.path;
    }
    if (!isFileRoot) {
      leftovers.push({ ...escape, end: leftoverEnd(walkEnd, frame.claimed) });
      return null;
    }
    const placedByTrail = placeByTrail(tree, escape, frame);
    if (placedByTrail) {
      tree = placedByTrail.tree;
      return placedByTrail.path;
    }
    const rooted = reRoot(tree, escape.child, escape.scope);
    tree = rooted.tree;
    return rooted.path;
  };

  for (const escape of frame.handedBack) seat(escape, []);

  for (
    let pending = nextPending(tree, frame.scope, done);
    pending;
    pending = nextPending(tree, frame.scope, done)
  ) {
    done.add(pending.node);
    const escapes = collapse(pending.node, pending.groupScope).escaped ?? [];
    if (escapes.length === 0) continue;
    const placements = new Map<string, string>();
    for (const escape of escapes) {
      const at = seat(escape, pending.names);
      const key = placementKey(hostChildOf(escape.child));
      if (at !== null && key && isFirstHolder(escape.child, isFileRoot)) {
        placements.set(key, pathFrom(pending.names, at));
      }
    }
    const hostChildren = new Set(escapes.map(({ child }) => hostChildOf(child)));
    // A seated child may have landed inside this instance, which the next scan then collapses again.
    const current = nodeAt(tree, pending.names) ?? pending.node;
    const stripped = withPlacements(withoutHostChildren(current, hostChildren), placements);
    if (current === pending.node) done.add(stripped);
    tree = replacedAt(tree, pending.names, () => stripped);
  }

  if (tree === frame.root.children && leftovers.length === 0) return { root: frame.root, escaped: [] };
  const { escaped: _graft, ...root } = frame.root;
  return { root: { ...root, children: tree }, escaped: leftovers };
}

/** Where a child that this frame could not place goes on from it: the frame is an instance, whose owner sits above. */
function leftoverEnd(walkEnd: string | null, claimed: ClaimedPath): string | null {
  if (walkEnd === null) return null;
  return walkEnd.startsWith(OUTSIDE) ? walkEnd : endAboveRoot(walkEnd, claimed);
}

/**
 * Where a walk that ended at `end` from the instance at `from` ends in the frame: its path from the
 * frame root, which climbs out with `..` where it leaves, or null where it found nothing. The root
 * is the empty path.
 */
function endInFrame(end: string | null, from: readonly string[]): string | null {
  if (end === null) return null;
  const simplified = simplifiedNodePath(joinPath(from.join('/'), end));
  return simplified === '.' ? SCENE_ROOT_PATH : simplified;
}

/** A tree with a child seated in it, and the path the child sits at. */
interface Seated {
  readonly tree: LiveNode[];
  readonly path: string;
}

/**
 * `tree` with the escaped child seated at the path `walkEnd` names in the frame, or null where it
 * names no node, or leaves the frame.
 */
function placeAt(
  tree: LiveNode[],
  walkEnd: string,
  { child, scope }: EscapedChild,
  { claimed, scope: frameScope }: Frame
): Seated | null {
  if (walkEnd.startsWith(OUTSIDE)) return null;
  const seat = withoutSubPath(child, scope);
  if (walkEnd === SCENE_ROOT_PATH) return { tree: addAtIndex(tree, seat), path: child.name };
  const segments = subPathSegments(walkEnd, tree, claimed);
  const grafted = segments && graftAt(tree, segments, seat, frameScope);
  return grafted && { tree: grafted, path: joinPath(segments.join('/'), child.name) };
}

/**
 * `tree` with the escaped child seated where its `parent_id_path=` puts it, for a `parent=` walk that
 * found nothing (packed_scene.cpp:161-163): under a heading of this file, or in the content of the
 * instance it enters. Null where the heading has no trail or the trail finds no node.
 */
function placeByTrail(tree: LiveNode[], escape: EscapedChild, frame: Frame): Seated | null {
  const fallback = escape.child.parentTrailFallback;
  if (!fallback) return null;
  const { contentTrail } = fallback;
  if (contentTrail === undefined) return placeAt(tree, fallback.path, escape, frame);
  // The root merged over its base already, and its graft followed the trail in that base.
  if (fallback.path === SCENE_ROOT_PATH) return null;
  const entering = { ...escape, child: { ...escape.child, parentContentTrail: contentTrail } };
  return placeAt(tree, fallback.path, entering, frame);
}

/** `child` as a node of the frame it is seated in: it keeps the scope it was written in. */
function withoutSubPath(child: LiveNode, scope: SceneScope): LiveNode {
  const { instanceSubPath: _held, parentTrailFallback: _spent, ...seat } = child;
  return { ...seat, scope, reanchoredFrom: hostChildOf(child) };
}

/**
 * `tree` with `child` under the file root and each of its descendants too, each renamed from its own
 * `parent=` and numbered past the root children that hold the name. A descendant sat below `child`
 * for a path that runs through the vanished parent, so it vanishes as well; one that an id trail
 * landed there stays (packed_scene.cpp:161-163). A `%Name` parent vanishes too: the renamed node
 * claims the renamed name (node.cpp:2222).
 */
function reRoot(tree: LiveNode[], child: LiveNode, scope: SceneScope): Seated {
  const rooted = [...tree];
  const names = new Set(rooted.map(({ name }) => name));
  let childName = child.name;
  const seatOne = (node: LiveNode): void => {
    const { instanceSubPath: _held, children, ...rest } = node;
    const name = reRootedName(node.parent ?? '.', node.name, names);
    names.add(name);
    if (node === child) childName = name;
    insertAtIndex(rooted, {
      ...rest,
      name,
      authoredName: node.name,
      scope: node.scope ?? scope,
      children: children.filter((below) => below.landedByIdTrail),
    });
    for (const below of children) if (!below.landedByIdTrail) seatOne(below);
  };
  seatOne(child);
  return { tree: rooted, path: childName };
}

/**
 * Whether the instance whose graft handed `child` back is the one whose heading wrote it. A copy that
 * a nested instance re-anchored was written above the frame, which only a file's frame sees whole.
 */
function isFirstHolder(child: LiveNode, isFileRoot: boolean): boolean {
  return child.reanchoredFrom === undefined || isFileRoot;
}

/** `path` from the node at `from`, which climbs out of it with `..` to the frame root. */
function pathFrom(from: readonly string[], path: string): string {
  return [...from.map(() => OUTSIDE), path].join('/');
}

/** `node` that records `placements` of the children it handed back, or the same node with none. */
function withPlacements(node: LiveNode, placements: ReadonlyMap<string, string>): LiveNode {
  if (placements.size === 0) return node;
  return { ...node, seatedPlacements: new Map([...(node.seatedPlacements ?? []), ...placements]) };
}

/** The first instance in `nodes`, in tree order, that holds deep children and is not done yet. */
function nextPending(
  nodes: readonly LiveNode[],
  groupScope: SceneScope,
  done: ReadonlySet<LiveNode>,
  above: readonly string[] = []
): Pending | undefined {
  for (const node of nodes) {
    if (!holdsDeepChildren(node)) continue;
    const names = [...above, node.name];
    if (!node.instance) {
      const deeper = nextPending(node.children, scopeOf(node, groupScope), done, names);
      if (deeper) return deeper;
    } else if (!done.has(node)) {
      return { node, names, groupScope };
    }
  }
  return undefined;
}

/** `node` without the host children in `removed`, at any depth, or the same node where it holds none. */
function withoutHostChildren(node: LiveNode, removed: ReadonlySet<LiveNode>): LiveNode {
  const kept = node.children.filter((child) => !removed.has(hostChildOf(child)));
  const children = kept.map((child) => withoutHostChildren(child, removed));
  const isUnchanged =
    children.length === node.children.length && children.every((c, i) => c === node.children[i]);
  return isUnchanged ? node : { ...node, children };
}
