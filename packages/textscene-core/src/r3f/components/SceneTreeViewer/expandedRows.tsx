import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { getAncestorPaths } from '../../../utils/nodePath.js';

/** What changes the scene tree's expanded rows. The previewer owns them: the view draws no tree. */
export interface ExpandedRowActions {
  toggle(path: string): void;
  /** Takes `paths` as given, so the caller hands over a set it no longer changes. */
  set(paths: ReadonlySet<string>): void;
  clear(): void;
  /** Expands each collapsed ancestor of `path`, so its row shows. */
  reveal(path: string): void;
}

const NO_PATHS: ReadonlySet<string> = new Set();

// Two contexts, so a component that only changes the rows does not render on each toggle.
const ExpandedPathsContext = createContext<ReadonlySet<string> | null>(null);
ExpandedPathsContext.displayName = 'ExpandedPathsContext';
const ExpandedRowActionsContext = createContext<ExpandedRowActions | null>(null);
ExpandedRowActionsContext.displayName = 'ExpandedRowActionsContext';

export function ExpandedRowsProvider({ children }: { children: ReactNode }) {
  const [paths, setPaths] = useState(NO_PATHS);
  const actions = useMemo<ExpandedRowActions>(
    () => ({
      toggle: (path) =>
        setPaths((previous) => {
          const next = new Set(previous);
          if (!next.delete(path)) next.add(path);
          return next;
        }),
      set: setPaths,
      clear: () => setPaths(NO_PATHS),
      reveal: (path) => setPaths((previous) => withAncestorsExpanded(previous, path)),
    }),
    []
  );
  return (
    <ExpandedRowActionsContext.Provider value={actions}>
      <ExpandedPathsContext.Provider value={paths}>{children}</ExpandedPathsContext.Provider>
    </ExpandedRowActionsContext.Provider>
  );
}

/** `expanded` with each ancestor of `nodePath` added, or `expanded` itself when none is missing. */
function withAncestorsExpanded(expanded: ReadonlySet<string>, nodePath: string): ReadonlySet<string> {
  const missing = getAncestorPaths(nodePath).filter((ancestor) => !expanded.has(ancestor));
  return missing.length === 0 ? expanded : new Set([...expanded, ...missing]);
}

export function useExpandedPaths(): ReadonlySet<string> {
  return required(useContext(ExpandedPathsContext), 'useExpandedPaths');
}

export function useExpandedRowActions(): ExpandedRowActions {
  return required(useContext(ExpandedRowActionsContext), 'useExpandedRowActions');
}

function required<T>(value: T | null, hook: string): T {
  if (value === null) throw new Error(`${hook} must be used inside an <ExpandedRowsProvider>, got none`);
  return value;
}
