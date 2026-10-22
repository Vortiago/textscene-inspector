/**
 * A node of the live scene tree: a parsed node, or one the Instance root merge built
 * from two files (ADR-0013). Only the merge writes `scope`, so the parse tree the
 * linter reads never carries it.
 */
import type { SceneScope, TscnNode } from '../parser/types.js';
import type { UniqueNameTable } from './instanceNameTable.js';

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
   * Set on a typed node attached into a GLB: the `relPath` of the GLB object its `instanceSubPath`
   * matched, so the tree finds its row by that key and matches nothing again.
   */
  readonly glbTargetRelPath?: string;
}

/**
 * The scope a node's refs and its children's resolve against: its own, else its group's.
 * A group does not stamp its children with it: solve-tree maps key on the raw node, and a copy breaks them.
 */
export function scopeOf(node: LiveNode, groupScope: SceneScope): SceneScope {
  return node.scope ?? groupScope;
}
