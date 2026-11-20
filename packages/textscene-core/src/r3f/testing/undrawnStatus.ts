import { useSyncExternalStore } from 'react';
import { useViewStatusStore } from '../viewStatus/ViewStatusContext';
import { subscribeToNothing } from '../../utils/subscribeToNothing';
import { undrawnNodeAt, type UndrawnNode } from '../viewStatus/undrawnNodes';

function useUndrawnNode(livePath: string): UndrawnNode | null {
  const store = useViewStatusStore();
  const undrawn = useSyncExternalStore(store?.subscribe ?? subscribeToNothing, () => store?.status().undrawn);
  return undrawn ? undrawnNodeAt(undrawn, livePath) : null;
}

export function useUndrawnMeshTypes(livePath: string): readonly string[] {
  return useUndrawnNode(livePath)?.meshTypes ?? [];
}

export function useIsEmptyShape(livePath: string): boolean {
  return useUndrawnNode(livePath)?.isEmptyShape ?? false;
}
