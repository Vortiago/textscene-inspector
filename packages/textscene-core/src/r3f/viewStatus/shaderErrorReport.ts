import { useEffect } from 'react';
import { useNodePath } from '../contexts/NodePathContext.js';
import { useViewStatusStore } from './ViewStatusContext.js';

/** Reports `message` as the enclosing node's shader error while mounted. Null reports nothing. */
export function useShaderErrorReport(message: string | null): void {
  const path = useNodePath();
  const store = useViewStatusStore();
  useEffect(() => {
    if (!store || message === null || path === null) return undefined;
    return store.reportUndrawn(path, { shaderError: message });
  }, [store, message, path]);
}
