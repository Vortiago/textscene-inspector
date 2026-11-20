/** Reads what the nearest view's status reports of one node, for a test that mounts the reporters. */
import { useSyncExternalStore } from 'react';
import { useViewStatusStore } from '../viewStatus/ViewStatusContext';
import { subscribeToNothing } from '../../utils/subscribeToNothing';
import type { UndrawnNode } from '../viewStatus/undrawnNodes';
import { absolutePathOf } from '../../scene/nodePathWalk';

function useUndrawnNode(livePath: string): UndrawnNode | undefined {
  const store = useViewStatusStore();
  const undrawn = useSyncExternalStore(store?.subscribe ?? subscribeToNothing, () => store?.status().undrawn);
  return undrawn?.find((node) => node.path === absolutePathOf(livePath));
}

export function useUndrawnMeshTypes(path: string): readonly string[] {
  return useUndrawnNode(path)?.meshTypes ?? [];
}

export function useIsEmptyShape(path: string): boolean {
  return useUndrawnNode(path)?.isEmptyShape ?? false;
}
