import { createContext, useContext, useState, type ReactNode } from 'react';
import { getAncestorPaths } from '../../../utils/nodePath.js';
import { createExternalStore, type ExternalStore } from '../../../utils/externalStore.js';
import { useExternalStoreSelection, useExternalStoreValue } from '../../hooks/createExternalStore.js';

/** What changes the scene tree's expanded rows. The previewer owns them: the view draws no tree. */
export interface ExpandedRowActions {
  toggle(path: string): void;
  set(paths: ReadonlySet<string>): void;
  clear(): void;
  /** Expands each collapsed ancestor of `path`, so its row shows. */
  reveal(path: string): void;
}

interface ExpandedRows {
  /** A store, not context state: a row subscribes to its own path, so a toggle renders that row alone. */
  paths: ExternalStore<ReadonlySet<string>>;
  actions: ExpandedRowActions;
}

const NO_PATHS: ReadonlySet<string> = new Set();

const ExpandedRowsContext = createContext<ExpandedRows | null>(null);
ExpandedRowsContext.displayName = 'ExpandedRowsContext';

export function ExpandedRowsProvider({ children }: { children: ReactNode }) {
  // Never-set state, so the store and its actions are made once per provider.
  const [rows] = useState(createExpandedRows);
  return <ExpandedRowsContext.Provider value={rows}>{children}</ExpandedRowsContext.Provider>;
}

function createExpandedRows(): ExpandedRows {
  const paths = createExternalStore(NO_PATHS);
  const actions: ExpandedRowActions = {
    toggle: (path) => {
      const next = new Set(paths.get());
      if (!next.delete(path)) next.add(path);
      paths.set(next);
    },
    // A copy, so a caller that changes its set later changes no row behind the store's back.
    set: (next) => paths.set(new Set(next)),
    clear: () => paths.set(NO_PATHS),
    reveal: (path) => paths.set(withAncestorsExpanded(paths.get(), path)),
  };
  return { paths, actions };
}

/** `expanded` with each ancestor of `nodePath` added, or `expanded` itself when none is missing. */
function withAncestorsExpanded(expanded: ReadonlySet<string>, nodePath: string): ReadonlySet<string> {
  const missing = getAncestorPaths(nodePath).filter((ancestor) => !expanded.has(ancestor));
  return missing.length === 0 ? expanded : new Set([...expanded, ...missing]);
}

export function useExpandedPaths(): ReadonlySet<string> {
  return useExternalStoreValue(useExpandedRows().paths);
}

/** Renders the caller only when this one row opens or shuts. */
export function useIsExpandedRow(path: string): boolean {
  return useExternalStoreSelection(useExpandedRows().paths, (paths) => paths.has(path));
}

export function useExpandedRowActions(): ExpandedRowActions {
  return useExpandedRows().actions;
}

function useExpandedRows(): ExpandedRows {
  const rows = useContext(ExpandedRowsContext);
  if (rows === null)
    throw new Error('the expanded rows must be read inside an <ExpandedRowsProvider>, got none');
  return rows;
}
