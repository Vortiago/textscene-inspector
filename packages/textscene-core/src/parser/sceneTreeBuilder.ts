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
  const remaining = nodes.filter(n => n !== rootNode);
  let lastRemainingCount = remaining.length + 1;

  // Process nodes iteratively until all are placed
  while (remaining.length > 0 && remaining.length < lastRemainingCount) {
    lastRemainingCount = remaining.length;

    for (let i = remaining.length - 1; i >= 0; i--) {
      const node = remaining[i];
      if (!node) continue;

      if (!node.parent) {
        remaining.splice(i, 1);
        continue;
      }

      // Handle "." as direct child of root
      if (node.parent === '.') {
        rootNode.children.push(node);
        pathMap.set(node.name, node);
        remaining.splice(i, 1);
        continue;
      }

      // Look up parent by its path
      const parentNode = pathMap.get(node.parent);
      if (parentNode) {
        parentNode.children.push(node);
        // Register this node's path (parent path + "/" + name)
        const nodePath = `${node.parent}/${node.name}`;
        pathMap.set(nodePath, node);
        remaining.splice(i, 1);
      }
    }
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
