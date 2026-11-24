import { useNodePath } from '../contexts/NodePathContext';
import { useIsSelectedPath } from '../contexts/SelectionContext';

export function useIsSelected(): boolean {
  return useIsSelectedPath(useNodePath());
}
