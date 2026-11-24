import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { withAncestorsExpanded } from '../../../utils/nodePath.js';

/** The scene tree's expanded rows, by live node path. The previewer owns them: the view draws no tree. */
export interface ExpandedRows {
  paths: ReadonlySet<string>;
  toggle(path: string): void;
  set(paths: ReadonlySet<string>): void;
  /** Expands each collapsed ancestor of `path`, so its row shows. */
  reveal(path: string): void;
}

const ExpandedRowsContext = createContext<ExpandedRows | null>(null);
ExpandedRowsContext.displayName = 'ExpandedRowsContext';

export function ExpandedRowsProvider({ children }: { children: ReactNode }) {
  const [paths, setPaths] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = useCallback((path: string) => {
    setPaths((previous) => {
      const next = new Set(previous);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  }, []);
  const set = useCallback((next: ReadonlySet<string>) => setPaths(new Set(next)), []);
  // The same set back when nothing is missing, so a reveal of a shown row renders nothing.
  const reveal = useCallback(
    (path: string) => setPaths((previous) => withAncestorsExpanded(previous, path)),
    []
  );
  const value = useMemo<ExpandedRows>(() => ({ paths, toggle, set, reveal }), [paths, toggle, set, reveal]);
  return <ExpandedRowsContext.Provider value={value}>{children}</ExpandedRowsContext.Provider>;
}

export function useExpandedRows(): ExpandedRows {
  const rows = useContext(ExpandedRowsContext);
  if (rows === null) throw new Error('useExpandedRows must be used inside an <ExpandedRowsProvider>');
  return rows;
}
