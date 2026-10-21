/**
 * The mesh types each node holds that no slice here builds, for the node's details. A mesh reader
 * reports its mesh's type through `useUndrawnMeshReport`. With no provider a report does nothing.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { meshKind } from '../../resources/meshes/meshSource.js';
import { useNodePath } from './NodePathContext.js';

interface UndrawnMeshesContextValue {
  /** One `undrawnKey` per node and mesh type reported. */
  undrawn: ReadonlySet<string>;
  report: (key: string) => void;
  clear: (key: string) => void;
}

const NOOP: UndrawnMeshesContextValue = { undrawn: new Set(), report: () => {}, clear: () => {} };

const UndrawnMeshesContext = createContext<UndrawnMeshesContextValue>(NOOP);
UndrawnMeshesContext.displayName = 'UndrawnMeshesContext';

/** A newline never occurs in a node path, so it splits the path from the type. */
function undrawnKey(nodePath: string, type: string): string {
  return `${nodePath}\n${type}`;
}

export function UndrawnMeshesProvider({ children }: { children: ReactNode }) {
  const [undrawn, setUndrawn] = useState<ReadonlySet<string>>(() => new Set());
  /** Open reports per key, written only by `report` and `clear`: several cells can hold one type. */
  const reportCounts = useRef(new Map<string, number>());

  const report = useCallback((key: string) => {
    const count = (reportCounts.current.get(key) ?? 0) + 1;
    reportCounts.current.set(key, count);
    if (count === 1) setUndrawn((prev) => new Set(prev).add(key));
  }, []);

  const clear = useCallback((key: string) => {
    const count = reportCounts.current.get(key) ?? 0;
    if (count > 1) {
      reportCounts.current.set(key, count - 1);
      return;
    }
    reportCounts.current.delete(key);
    setUndrawn((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ undrawn, report, clear }), [undrawn, report, clear]);
  return <UndrawnMeshesContext.Provider value={value}>{children}</UndrawnMeshesContext.Provider>;
}

/** Reports the enclosing node's mesh of `type` while no slice builds that type. Null reports nothing. */
export function useUndrawnMeshReport(type: string | null): void {
  const nodePath = useNodePath();
  const { report, clear } = useContext(UndrawnMeshesContext);
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
  const { undrawn } = useContext(UndrawnMeshesContext);
  return useMemo(() => {
    const prefix = undrawnKey(nodePath, '');
    return [...undrawn]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
      .sort();
  }, [undrawn, nodePath]);
}
