import { useMemo } from 'react';
import { useUndrawnReport } from './useUndrawnReport.js';

/** Reports `message` as the enclosing node's shader error while mounted. Null reports nothing. */
export function useShaderErrorReport(message: string | null): void {
  useUndrawnReport(useMemo(() => (message === null ? null : { shaderError: message }), [message]));
}
