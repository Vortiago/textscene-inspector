/**
 * Whether the node being rendered is the one selected in the tree. False outside a node dispatcher
 * and outside a selection provider.
 */

import { useNodePath } from '../contexts/NodePathContext';
import { useOptionalSelection } from '../contexts/SelectionContext';

export function useIsSelected(): boolean {
  const nodePath = useNodePath();
  const selectedNodePath = useOptionalSelection()?.selectedNodePath ?? null;
  return nodePath !== null && nodePath === selectedNodePath;
}
