/**
 * Builds hierarchical scene tree from flat TSCN node list.
 */

import type { TscnNode } from './types';
import { warn } from '../logger';

/**
 * Build scene tree from flat node list using parent path references.
 * Parent paths in TSCN are relative to root: "." = root, "Foo/Bar" = root/Foo/Bar
 */
export function buildSceneTree(nodes: TscnNode[]): TscnNode[] {
  if (nodes.length === 0) return [];

  // Find root node (has no parent)
  const rootNode = nodes.find(n => !n.parent);
  if (!rootNode) {
    return nodes;
  }

  // Map from relative path to node (paths don't include root name)
  const pathMap = new Map<string, TscnNode>();
  pathMap.set('', rootNode); // Root is at empty path

  // Track remaining nodes to place
  let remaining = nodes.filter(n => n !== rootNode);
  let lastRemainingCount = remaining.length + 1;

  // Process nodes iteratively until all are placed. Iterate FORWARD (declaration
  // order) and rebuild `remaining` with the unplaced nodes each pass — this both
  // preserves sibling order (so `children` matches the .tscn declaration order,
  // which is the 2D paint order: earlier siblings draw behind) and avoids the
  // index-shifting hazards of splicing mid-iteration. Multiple passes place
  // children whose parent appears later in the file.
  while (remaining.length > 0 && remaining.length < lastRemainingCount) {
    lastRemainingCount = remaining.length;
    const stillRemaining: TscnNode[] = [];

    for (const node of remaining) {
      if (!node.parent) {
        // No parent and not the root → drop it (handled by the orphan warning
        // only if it never resolves; a parentless non-root is simply skipped).
        continue;
      }

      // "." means a direct child of root; otherwise resolve by parent path.
      const parentNode = node.parent === '.' ? rootNode : pathMap.get(node.parent);
      if (parentNode) {
        parentNode.children.push(node);
        const nodePath = node.parent === '.' ? node.name : `${node.parent}/${node.name}`;
        pathMap.set(nodePath, node);
      } else {
        stillRemaining.push(node);
      }
    }

    remaining = stillRemaining;
  }

  // Warn about any orphaned nodes
  if (remaining.length > 0) {
    warn(`WARNING: ${remaining.length} orphaned nodes will be dropped from scene tree!`);
    for (const node of remaining) {
      warn(`  Orphaned: "${node.name}" (type: ${node.type}, parent: "${node.parent}", instance: ${node.instance || 'none'})`);
    }
  }

  return [rootNode];
}
