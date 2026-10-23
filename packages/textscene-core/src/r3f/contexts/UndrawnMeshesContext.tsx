/**
 * The mesh types each node holds that no slice here builds, for the node's details. A mesh reader
 * reports its mesh's type through `useUndrawnMeshReport`. With no provider a report does nothing.
 */
import { useMemo } from 'react';
import { meshKind } from '../../resources/meshes/meshSource.js';
import { createCountedReportsContext } from './countedReportsContext.js';
import { useNodePath } from './NodePathContext.js';

/** One `undrawnKey` per node and mesh type reported. */
const undrawn = createCountedReportsContext('UndrawnMeshes');

export const UndrawnMeshesProvider = undrawn.Provider;

/** A newline never occurs in a node path, so it splits the path from the type. */
function undrawnKey(nodePath: string, type: string): string {
  return `${nodePath}\n${type}`;
}

/** Reports the enclosing node's mesh of `type` while no slice builds that type. Null reports nothing. */
export function useUndrawnMeshReport(type: string | null): void {
  const nodePath = useNodePath();
  // Several cells can hold one type, so a key stays while any of them reports it.
  undrawn.useReportWhile(
    nodePath !== null && type !== null && meshKind(type) === null ? undrawnKey(nodePath, type) : null
  );
}

/** The mesh types the node at `nodePath` holds that no slice builds, in name order. */
export function useUndrawnMeshTypes(nodePath: string): string[] {
  const keys = undrawn.useReported();
  return useMemo(() => {
    const prefix = undrawnKey(nodePath, '');
    return [...keys]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
      .sort();
  }, [keys, nodePath]);
}
