/**
 * Aggregates per-resource missing / uploaded state across an entire
 * preview shell so a single DOM panel can list every unresolved path.
 *
 * Replaces the pre-migration `missingResourcesMap` in
 * `apps/textscene-web/src/main.ts`.
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
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { resourceFilePath } from '../../resources/subResourcePath.js';

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
  /**
   * Observer for the live missing-paths set — fired after mount and after
   * every change (never on mere callback-identity changes, so hosts may pass
   * an inline arrow). The explicit surface for code OUTSIDE the provider's
   * subtree (e.g. a host drop handler above the shell) to read the current
   * set; consumers inside the tree use `useMissingResources` instead.
   */
  onMissingPathsChange?: (paths: ReadonlySet<string>) => void;
}

export function MissingResourcesProvider({
  children,
  onMissingPathsChange,
}: MissingResourcesProviderProps) {
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
    // The two sets are keyed differently and this is the ONE place that knows
    // it. `missingPaths` holds resource IDENTITIES, because that is what a
    // consumer asked for and will ask for again — a **Sub-resource path**
    // included. `uploadedPaths` holds FILES, because a file is what the user
    // supplied and what a host's provider stores against. So uploading one
    // `.tres` that backs three surface materials clears three missing rows and
    // shows ONE uploaded row with one Remove button, instead of three rows for
    // one file picked once.
    setUploadedPaths((prev) => {
      const file = resourceFilePath(path);
      if (prev.has(file)) return prev;
      const next = new Set(prev);
      next.add(file);
      return next;
    });
    setMissingPaths((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  /** Takes a FILE — the key `markUploaded` stored, and what an uploaded row is. */
  const removeUploaded = useCallback((path: string) => {
    if (!path) return;
    setUploadedPaths((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  // Latest-callback ref: notifying must key ONLY on the set's identity. An
  // unmemoized host callback in the deps would re-fire per render — and a
  // host that stores the set in state would then loop render→notify→render.
  const onMissingPathsChangeRef = useRef(onMissingPathsChange);
  useEffect(() => {
    onMissingPathsChangeRef.current = onMissingPathsChange;
  });
  useEffect(() => {
    onMissingPathsChangeRef.current?.(missingPaths);
  }, [missingPaths]);

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
