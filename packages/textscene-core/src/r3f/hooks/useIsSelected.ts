/**
 * Whether the node being rendered is the one selected in the tree. False outside a node dispatcher
 * and outside a selection provider.
 */

import { useNodePath } from '../contexts/NodePathContext';
import { useIsSelectedPath } from '../contexts/SelectionContext';

export function useIsSelected(): boolean {
  return useIsSelectedPath(useNodePath());
}
