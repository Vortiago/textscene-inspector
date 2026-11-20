import { useEffect } from 'react';
import { useViewStatusStore } from './ViewStatusContext.js';
import { useNodePath } from '../contexts/NodePathContext.js';

/** Reports the enclosing node's mesh of `type` to the view's status while no slice draws it. Null reports nothing. */
export function useUndrawnMeshReport(type: string | null): void {
  const store = useViewStatusStore();
  const path = useNodePath();
  // Several cells can hold one type, so a node keeps a type while any of them reports it.
  useEffect(() => {
    if (!store || path === null || type === null) return undefined;
    return store.reportUndrawn(path, { meshType: type });
  }, [store, path, type]);
}
