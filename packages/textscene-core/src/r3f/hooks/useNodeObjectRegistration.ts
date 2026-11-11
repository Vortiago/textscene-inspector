import { useCallback } from 'react';
import type { Object3D } from 'three';
import { useSelection } from '../contexts/SelectionContext.js';
import { useIsUnownedSubtree } from '../contexts/UnownedSubtreeContext.js';

/**
 * A ref callback that registers the group it holds as the object of the node at `path`. The pointer
 * root resolves a hit to its nearest registered ancestor, the highlights and an animation track find
 * the object by path. A node below an unowned subtree registers nothing (`UnownedSubtreeContext`).
 */
export function useNodeObjectRegistration(path: string): (object: Object3D | null) => void {
  const { registerNodeObject, unregisterNodeObject } = useSelection();
  const isUnowned = useIsUnownedSubtree();
  return useCallback(
    (object) => {
      if (isUnowned) return;
      if (object) registerNodeObject(path, object);
      else unregisterNodeObject(path);
    },
    [path, isUnowned, registerNodeObject, unregisterNodeObject]
  );
}
