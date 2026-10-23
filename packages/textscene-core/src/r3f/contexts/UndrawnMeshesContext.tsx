/**
 * The mesh types each node holds that no slice here builds, for the node's details. A mesh reader
 * reports its mesh's type through `useUndrawnMeshReport`. With no provider a report does nothing.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { meshKind } from '../../resources/meshes/meshSource.js';
import { useCountedReports } from '../hooks/useCountedReports.js';
import { useNodePath } from './NodePathContext.js';

interface UndrawnMeshReports {
  report: (key: string) => void;
  clear: (key: string) => void;
}

/** Apart from the reports, so a change to the set re-renders only its readers, not each reporter. */
const UndrawnReportsContext = createContext<UndrawnMeshReports>({ report: () => {}, clear: () => {} });
UndrawnReportsContext.displayName = 'UndrawnReportsContext';

/** One `undrawnKey` per node and mesh type reported. */
const UndrawnMeshesContext = createContext<ReadonlySet<string>>(new Set());
UndrawnMeshesContext.displayName = 'UndrawnMeshesContext';

/** A newline never occurs in a node path, so it splits the path from the type. */
function undrawnKey(nodePath: string, type: string): string {
  return `${nodePath}\n${type}`;
}

export function UndrawnMeshesProvider({ children }: { children: ReactNode }) {
  // Several cells can hold one type, so a key stays while any of them reports it.
  const { reported: undrawn, report, clear } = useCountedReports();
  const reports = useMemo(() => ({ report, clear }), [report, clear]);
  return (
    <UndrawnReportsContext.Provider value={reports}>
      <UndrawnMeshesContext.Provider value={undrawn}>{children}</UndrawnMeshesContext.Provider>
    </UndrawnReportsContext.Provider>
  );
}

/** Reports the enclosing node's mesh of `type` while no slice builds that type. Null reports nothing. */
export function useUndrawnMeshReport(type: string | null): void {
  const nodePath = useNodePath();
  const { report, clear } = useContext(UndrawnReportsContext);
  const key =
    nodePath !== null && type !== null && meshKind(type) === null ? undrawnKey(nodePath, type) : null;
  useEffect(() => {
    if (key === null) return undefined;
    report(key);
    return () => clear(key);
  }, [key, report, clear]);
}

/** The mesh types the node at `nodePath` holds that no slice builds, in name order. */
export function useUndrawnMeshTypes(nodePath: string): string[] {
  const undrawn = useContext(UndrawnMeshesContext);
  return useMemo(() => {
    const prefix = undrawnKey(nodePath, '');
    return [...undrawn]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
      .sort();
  }, [undrawn, nodePath]);
}
