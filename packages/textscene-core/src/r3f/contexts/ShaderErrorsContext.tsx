import { useMemo } from 'react';
import { createCountedReportsContext } from './countedReportsContext.js';
import { useNodePath } from './NodePathContext.js';

/** One `errorKey` per node and error text, for the node's details. With no provider nothing reports. */
const shaderErrors = createCountedReportsContext('ShaderErrors');

export const ShaderErrorsProvider = shaderErrors.Provider;

/** A newline never occurs in a node path, so it splits the path from the text. */
function errorKey(nodePath: string, message: string): string {
  return `${nodePath}\n${message}`;
}

/** Reports `message` for the enclosing node while the caller is mounted. Null reports nothing. */
export function useShaderErrorReport(message: string | null): void {
  const nodePath = useNodePath();
  shaderErrors.useReportWhile(nodePath !== null && message !== null ? errorKey(nodePath, message) : null);
}

/** The shader errors of the node at `nodePath`, in text order. */
export function useShaderErrors(nodePath: string): string[] {
  const keys = shaderErrors.useReported();
  return useMemo(() => {
    const prefix = errorKey(nodePath, '');
    return [...keys]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
      .sort();
  }, [keys, nodePath]);
}
