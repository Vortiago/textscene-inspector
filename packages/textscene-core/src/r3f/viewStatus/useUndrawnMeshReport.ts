import { useMemo } from 'react';
import { useUndrawnReport } from './useUndrawnReport.js';

/** Reports the enclosing node's mesh of `type` while no slice draws it. Null reports nothing. */
export function useUndrawnMeshReport(type: string | null): void {
  // Several cells can hold one type, so a node keeps a type while any of them reports it.
  useUndrawnReport(useMemo(() => (type === null ? null : { meshType: type }), [type]));
}
