/**
 * Scene graph traversal utilities.
 */

import type { TscnNode } from '../parser/types';

export function findNodeByPath(nodes: TscnNode[], targetPath: string): TscnNode | null {
  const findInNodes = (nodeList: TscnNode[], currentPath: string): TscnNode | null => {
    for (const node of nodeList) {
      const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;

      if (nodePath === targetPath) {
        return node;
      }

      if (node.children && node.children.length > 0) {
        const found = findInNodes(node.children, nodePath);
        if (found) return found;
      }
    }
    return null;
  };

  return findInNodes(nodes, '');
}
