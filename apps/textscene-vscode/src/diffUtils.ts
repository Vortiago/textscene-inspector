/**
 * Utilities for computing incremental changes between TSCN scene versions.
 */

import { TscnParser, buildNodeHashMap, type TscnScene, type TscnNode, type NodeChange } from '@textscene/core';

interface DiffResult {
  updateType: 'full' | 'incremental';
  changes?: NodeChange[];
  newScene?: TscnScene;
}

/**
 * Finds a node by path in the scene tree.
 */
function findNodeByPath(nodes: TscnNode[], targetPath: string): TscnNode | null {
  const parts = targetPath.split('/');
  let current = nodes;
  let node: TscnNode | null = null;

  for (const part of parts) {
    node = current.find(n => n.name === part) || null;
    if (!node) {
      return null;
    }
    current = node.children;
  }

  return node;
}

/**
 * Computes the parent path from a full node path.
 */
function getParentPath(nodePath: string): string | undefined {
  const parts = nodePath.split('/');
  parts.pop();
  return parts.length > 0 ? parts.join('/') : undefined;
}

/**
 * Computes incremental changes between old and new TSCN content using hash comparison.
 */
export function computeIncrementalChanges(oldContent: string, newContent: string): DiffResult {
  const parser = new TscnParser();

  try {
    const oldScene = parser.parse(oldContent);
    const newScene = parser.parse(newContent);

    const oldHashMap = buildNodeHashMap(oldScene.nodes);
    const newHashMap = buildNodeHashMap(newScene.nodes);

    const changes: NodeChange[] = [];
    const allPaths = new Set([...oldHashMap.keys(), ...newHashMap.keys()]);

    let addedCount = 0;
    let removedCount = 0;
    let modifiedCount = 0;

    // Detect changes
    for (const nodePath of allPaths) {
      const oldHash = oldHashMap.get(nodePath);
      const newHash = newHashMap.get(nodePath);

      if (!oldHash && newHash) {
        // Node was added
        const node = findNodeByPath(newScene.nodes, nodePath);
        if (node) {
          changes.push({
            type: 'add',
            nodePath,
            node,
            parentPath: getParentPath(nodePath),
          });
          addedCount++;
        }
      } else if (oldHash && !newHash) {
        // Node was removed
        changes.push({
          type: 'remove',
          nodePath,
        });
        removedCount++;
      } else if (oldHash !== newHash) {
        // Node was modified
        const node = findNodeByPath(newScene.nodes, nodePath);
        if (node) {
          changes.push({
            type: 'update',
            nodePath,
            node,
            parentPath: getParentPath(nodePath),
          });
          modifiedCount++;
        }
      }
    }

    const totalNodes = allPaths.size;
    const changedNodes = addedCount + removedCount + modifiedCount;
    const changeRatio = changedNodes / totalNodes;

    // Decide update strategy
    if (changeRatio > 0.5) {
      // More than 50% changed - full reload is more efficient
      return { updateType: 'full', newScene };
    }

    // Check if tree structure changed significantly
    const structureChanged = addedCount > 0 || removedCount > 0;
    if (structureChanged && changeRatio > 0.3) {
      // Significant structure changes - safer to full reload
      return { updateType: 'full', newScene };
    }

    // Incremental update is appropriate
    return {
      updateType: 'incremental',
      changes,
      newScene,
    };
  } catch (error) {
    console.error('[TscnPreviewPanel] Error computing diff:', error);
    // On error, fall back to full reload
    return { updateType: 'full' };
  }
}
