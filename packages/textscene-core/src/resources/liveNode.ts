/**
 * A node of the live scene tree: a parsed node, or one the Instance root merge built
 * from two files (ADR-0013). Only the merge writes `scope`, so the parse tree the
 * linter reads never carries it.
 */
import type { SceneScope, TscnNode } from '../parser/types.js';

export interface LiveNode extends TscnNode {
  /**
   * The scope this node's refs and its children's resolve against, where it differs from
   * the group's: the outer scene's for a node grafted from it, or the sub-scene's with
   * the resources an override added (`rehomeOverride`) for a node an override reached.
   */
  readonly scope?: SceneScope;
  children: LiveNode[];
}

/** The scope a node's refs and its children's resolve against: its own, else its group's. */
export function scopeOf(node: LiveNode, groupScope: SceneScope): SceneScope {
  return node.scope ?? groupScope;
}
