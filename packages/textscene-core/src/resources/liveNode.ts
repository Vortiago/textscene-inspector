/**
 * A node of the live scene tree: a parsed node, or one the Instance root merge built
 * from two files (ADR-0013). Only the merge writes `scope`, so the parse tree the
 * linter reads never carries it.
 */
import type { SceneScope, TscnNode } from '../parser/types.js';
import type { UniqueNameTable } from './instanceNameTable.js';
import { resolveInstancePath } from './SubResourceResolver.js';

/**
 * A host child that its instance's graft could not seat inside the instance: the walk of its
 * `parent=` ended outside, or found nothing.
 */
export interface EscapedChild {
  /** The child as its instance held it, with the `instanceSubPath` its heading gave it. */
  readonly child: LiveNode;
  /** The scope the child's refs resolve in: the one of the file that wrote it. */
  readonly scope: SceneScope;
  /**
   * Where the walk ended: the path from the instance root, which climbs out with `..` and may end
   * in a `%Name` for the scene above to answer, or null where the walk found nothing.
   */
  readonly end: string | null;
}

export interface LiveNode extends TscnNode {
  /**
   * The scope this node's refs and its children's resolve against, where it differs from
   * the group's: the outer scene's for a node grafted from it, or the sub-scene's with
   * the resources an override added (`rehomeOverride`) for a node an override reached.
   */
  readonly scope?: SceneScope;
  children: LiveNode[];
  /**
   * Set by the merge on a collapsed instance: its `%Name` table, each key to the path below this
   * node that holds it. Godot keeps it on the instance root (node.cpp:2222-2234).
   */
  readonly uniqueNames?: UniqueNameTable;
  /** Set by the merge on a collapsed instance: `GraftedInstance.uniqueParentPlacements`. */
  readonly uniqueParentPlacements?: ReadonlyMap<string, string>;
  /**
   * Set by the merge on a collapsed instance: the host children it could not seat inside itself, in
   * the order of their headings. The file that wrote them seats them (`seatEscaped`).
   */
  readonly escaped?: readonly EscapedChild[];
  /**
   * Set on an instance by the file that seated the host children the instance handed back: where each
   * went, keyed like `uniqueParentPlacements`, with the path climbing out of the instance with `..`.
   */
  readonly seatedPlacements?: ReadonlyMap<string, string>;
  /**
   * Set on a host child that the graft re-anchored at a nested instance: the child as the first
   * instance held it. The file that seats the child from there removes this one (`hostChildOf`).
   */
  readonly reanchoredFrom?: LiveNode;
  /**
   * Set on a typed node attached into a GLB: the `relPath` of the GLB object its `instanceSubPath`
   * matched, so the tree finds its row by that key and matches nothing again.
   */
  readonly glbTargetRelPath?: string;
}

/** The host child `node` stands for: itself, or the child it is the re-anchored copy of. */
export function hostChildOf(node: LiveNode): LiveNode {
  return node.reanchoredFrom ?? node;
}

/**
 * The scope a node's refs and its children's resolve against: its own, else its group's.
 * A group does not stamp its children with it: solve-tree maps key on the raw node, and a copy breaks them.
 */
export function scopeOf(node: LiveNode, groupScope: SceneScope): SceneScope {
  return node.scope ?? groupScope;
}

/**
 * The `res://` path of the scene `node` instances, its ref resolved in the scope of the file that
 * authored it ({@link scopeOf}). Null for a node with no instance ref, or a ref that scope does not
 * declare.
 */
export function liveInstancePath(node: LiveNode, groupScope: SceneScope): string | null {
  if (!node.instance) return null;
  return resolveInstancePath(node.instance, scopeOf(node, groupScope).externalResources);
}
