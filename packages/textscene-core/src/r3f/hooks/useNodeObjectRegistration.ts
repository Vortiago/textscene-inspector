/**
 * Registers the group of a node in the selection registry, for the nodes that mount their own wrapper.
 */

import { useCallback } from 'react';
import type { Object3D } from 'three';
import { useSelection } from '../contexts/SelectionContext.js';
import { useIsUnownedSubtree } from '../contexts/UnownedSubtreeContext.js';
import { useInstanceOwners } from '../contexts/InstanceOwnersContext.js';
import { useInstancedScenePaths } from '../contexts/InstancedScenePathsContext.js';
import { isEditableNode } from '../instanceOwners.js';
import { belowRoot } from '../../utils/nodePath.js';

/**
 * A ref callback that registers the group it holds as the object of the node at `path`. The pointer
 * root resolves a hit to its nearest registered ancestor, the highlights and an animation track find
 * the object by path. A node below an unowned subtree registers nothing (`UnownedSubtreeContext`).
 */
export function useNodeObjectRegistration(path: string): (object: Object3D | null) => void {
  const { registerNodeObject, registerUnpickableNodeObject, unregisterNodeObject } = useSelection();
  const isUnowned = useIsUnownedSubtree();
  const isPickable = useIsEditableNode(path);
  const register = isPickable ? registerNodeObject : registerUnpickableNodeObject;
  return useCallback(
    (object) => {
      if (isUnowned) return;
      if (object) register(path, object);
      else unregisterNodeObject(path);
    },
    [path, isUnowned, register, unregisterNodeObject]
  );
}

// A click picks the nearest node an editable scene owns (`node_3d_editor_plugin.cpp:807-815`).
function useIsEditableNode(path: string): boolean {
  const owners = useInstanceOwners();
  const level = useInstancedScenePaths().length;
  return level === 0 || isEditableNode(owners, level, belowRoot(path));
}
