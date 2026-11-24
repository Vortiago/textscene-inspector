import { useEffect } from 'react';
import { useNodePath } from '../contexts/NodePathContext.js';
import { useViewStatusStore } from './ViewStatusContext.js';
import type { UndrawnReason } from './undrawnNodes.js';

/**
 * Reports the enclosing node for `reason` while mounted, null for nothing. A new object reports again.
 *
 * @canonical Report a node the view does not draw as authored
 */
export function useUndrawnReport(reason: UndrawnReason | null): void {
  const store = useViewStatusStore();
  const path = useNodePath();
  useEffect(() => {
    if (!store || path === null || reason === null) return undefined;
    return store.reportUndrawn(path, reason);
  }, [store, path, reason]);
}
