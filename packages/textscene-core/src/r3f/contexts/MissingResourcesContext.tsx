/**
 * The missing and uploaded paths of a whole preview shell, for one panel. A
 * context, not an event subscription: each `useResource` knows its path is
 * needed and reports it. With no provider the actions do nothing and the sets
 * are empty, so a hook calls `report` without a null check.
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
  /** Paths the user uploaded a file for through `addUploadedFile`. */
  uploadedPaths: ReadonlySet<string>;
  /** `useResource` calls it when the status becomes `'missing'`. Each call needs its own `clear`. */
  report: (path: string) => void;
  /** Withdraws one `report`. The path leaves `missingPaths` when its last report is withdrawn. */
  clear: (path: string) => void;
  /** Marks a path uploaded and removes it from `missingPaths`. */
  markUploaded: (path: string) => void;
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
   * Fired after mount and after every change of the missing set, never on a
   * new callback identity, so a host may pass an inline arrow. It serves code
   * outside the subtree. Code inside uses `useMissingResources`.
   */
  onMissingPathsChange?: (paths: ReadonlySet<string>) => void;
}

export function MissingResourcesProvider({ children, onMissingPathsChange }: MissingResourcesProviderProps) {
  const [missingPaths, setMissingPaths] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [uploadedPaths, setUploadedPaths] = useState<ReadonlySet<string>>(() => new Set<string>());

  /**
   * Open reports per path, written only by the actions below. Several slots can
   * consume one path, so the first to unmount must not retire the row while the
   * others still render it unresolved.
   */
  const reportCounts = useRef(new Map<string, number>());

  // The actions have empty deps, so an effect that depends on one does not
  // re-run on each state change. An effect on the whole context object loops,
  // so a consumer takes the actions by name.
  const report = useCallback((path: string) => {
    if (!path) return;
    const count = (reportCounts.current.get(path) ?? 0) + 1;
    reportCounts.current.set(path, count);
    if (count === 1) setMissingPaths((prev) => withPath(prev, path));
  }, []);

  const clear = useCallback((path: string) => {
    const count = reportCounts.current.get(path);
    if (count === undefined) return;
    if (count > 1) {
      reportCounts.current.set(path, count - 1);
      return;
    }
    reportCounts.current.delete(path);
    setMissingPaths((prev) => withoutPath(prev, path));
  }, []);

  const markUploaded = useCallback((path: string) => {
    if (!path) return;
    // Only this place knows the two keys. `missingPaths` holds resource identities,
    // a **Sub-resource path** included. `uploadedPaths` holds files, what the user
    // supplied. One `.tres` behind three materials clears three missing rows and
    // shows one uploaded row.
    setUploadedPaths((prev) => withPath(prev, resourceFilePath(path)));
    // An upload heals every consumer of the path at once, so all its reports go.
    reportCounts.current.delete(path);
    setMissingPaths((prev) => withoutPath(prev, path));
  }, []);

  /** Takes a file, the key `markUploaded` stored. */
  const removeUploaded = useCallback((path: string) => {
    if (!path) return;
    setUploadedPaths((prev) => withoutPath(prev, path));
  }, []);

  // A ref, so notification keys only on the set's identity. A host callback in
  // the deps re-fires each render, and a host storing the set in state loops.
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

  return <MissingResourcesContext.Provider value={value}>{children}</MissingResourcesContext.Provider>;
}

/** `paths` with `path` added. The same set when it is already there, so no consumer re-renders. */
function withPath(paths: ReadonlySet<string>, path: string): ReadonlySet<string> {
  if (paths.has(path)) return paths;
  const next = new Set(paths);
  next.add(path);
  return next;
}

/** `paths` without `path`. The same set when it is not there, so no consumer re-renders. */
function withoutPath(paths: ReadonlySet<string>, path: string): ReadonlySet<string> {
  if (!paths.has(path)) return paths;
  const next = new Set(paths);
  next.delete(path);
  return next;
}

export function useMissingResources(): MissingResourcesContextValue {
  return useContext(MissingResourcesContext);
}
