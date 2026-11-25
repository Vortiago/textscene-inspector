import { useEffect } from 'react';
import { rendersOwnVisual } from '../nodeSupport.js';
import { useViewStatusStore } from './ViewStatusContext.js';

/** Reports the node at the live path `path` while the view has no component for its `type`. */
export function useNoComponentReport(path: string, type: string): void {
  const store = useViewStatusStore();
  const hasNoComponent = rendersOwnVisual(type) === 'not-implemented';
  useEffect(() => {
    if (!store || !hasNoComponent) return undefined;
    return store.reportUndrawn(path, 'no-component');
  }, [store, path, hasNoComponent]);
}
