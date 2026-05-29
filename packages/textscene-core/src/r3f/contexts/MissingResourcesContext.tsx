/**
 * Aggregates per-resource missing / uploaded state across an entire
 * preview shell so a single DOM panel can list every unresolved path.
 *
 * Replaces the pre-migration `missingResourcesMap` in
 * `apps/textscene-web/src/main.ts` (see `docs/UX-REGRESSIONS.md` §3).
 *
 * Why a context, not an event subscription:
 *   `FileEventBus` only emits `loaded` / `failed` for paths the loader
 *   has been *asked* about. The dispatcher's per-node `useResource`
 *   calls are the single source of truth for "this path was needed by
 *   something in the tree". Each consumer reports up here when it
 *   transitions to `missing` and clears when it transitions to
 *   `loaded` (or unmounts).
 *
 * Default (no-provider) shape:
 *   When `useResource` runs outside a `<MissingResourcesProvider>`
 *   (e.g. a linter-only caller, a unit test), the context returns
 *   no-op actions and empty sets. Hook consumers can call `report`
 *   unconditionally without checking for null.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface MissingResourcesContextValue {
  /** Paths the dispatcher's resource hooks currently report as missing. */
  missingPaths: ReadonlySet<string>;
  /** Paths the user has uploaded a file for via `addUploadedFile`. */
  uploadedPaths: ReadonlySet<string>;
  /** Report a path as missing — called from `useResource` when status becomes `'missing'`. */
  report: (path: string) => void;
  /** Clear a path from the missing set — called from `useResource` when status becomes `'loaded'` or on unmount. */
  clear: (path: string) => void;
  /** Mark a path as uploaded. Removes it from `missingPaths` if present. */
  markUploaded: (path: string) => void;
  /** Remove a previously-uploaded path. */
  removeUploaded: (path: string) => void;
}

const NOOP: MissingResourcesContextValue = {
  missingPaths: new Set(),
  uploadedPaths: new Set(),
  report: () => {},
  clear: () => {},
  markUploaded: () => {},
  removeUploaded: () => {},
};

const MissingResourcesContext = createContext<MissingResourcesContextValue>(NOOP);
MissingResourcesContext.displayName = 'MissingResourcesContext';

export interface MissingResourcesProviderProps {
  children: ReactNode;
}

export function MissingResourcesProvider({ children }: MissingResourcesProviderProps) {
  const [missingPaths, setMissingPaths] = useState<ReadonlySet<string>>(
    () => new Set<string>()
  );
  const [uploadedPaths, setUploadedPaths] = useState<ReadonlySet<string>>(
    () => new Set<string>()
  );

  // STABILITY CONTRACT: report / clear / markUploaded / removeUploaded
  // must be `useCallback`d with empty deps so consumers (notably
  // `useResource`) can depend on them in effects without re-running on
  // every provider state change. Naively depending on the whole context
  // object would create an infinite render loop because each setter
  // mutates state → new context value object → effect re-runs → reports
  // again. Pull these callbacks out by name in consumers, not the
  // context object as a whole.
  const report = useCallback((path: string) => {
    if (!path) return;
    setMissingPaths((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  const clear = useCallback((path: string) => {
    if (!path) return;
    setMissingPaths((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  const markUploaded = useCallback((path: string) => {
    if (!path) return;
    setUploadedPaths((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
    setMissingPaths((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  const removeUploaded = useCallback((path: string) => {
    if (!path) return;
    setUploadedPaths((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  const value = useMemo<MissingResourcesContextValue>(
    () => ({
      missingPaths,
      uploadedPaths,
      report,
      clear,
      markUploaded,
      removeUploaded,
    }),
    [missingPaths, uploadedPaths, report, clear, markUploaded, removeUploaded]
  );

  return (
    <MissingResourcesContext.Provider value={value}>
      {children}
    </MissingResourcesContext.Provider>
  );
}

export function useMissingResources(): MissingResourcesContextValue {
  return useContext(MissingResourcesContext);
}
