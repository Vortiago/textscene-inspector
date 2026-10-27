/**
 * Whether an instanced scene authored the node being rendered, below an instance the edited scene
 * does not list as editable (`node_3d_editor_gizmos.cpp:43-60`). False outside a node dispatcher.
 */

import { useInstanceOwners } from '../contexts/InstanceOwnersContext';
import { useInstancedScenePaths } from '../contexts/InstancedScenePathsContext';
import { useNodePath } from '../contexts/NodePathContext';
import { isEditableNode } from '../instanceOwners';
import { belowRoot } from '../../utils/nodePath';

export function useIsInstantiated(): boolean {
  const owners = useInstanceOwners();
  const level = useInstancedScenePaths().length;
  const path = useNodePath();
  if (path === null || level === 0) return false;
  return !isEditableNode(owners, level, belowRoot(path));
}
