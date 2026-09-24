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
  /** `useResource` calls it when the status becomes `'missing'`. */
  report: (path: string) => void;
  /** `useResource` calls it when the status becomes `'loaded'`, and on unmount. */
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

  // The actions have empty deps, so an effect that depends on one does not
  // re-run on each state change. An effect on the whole context object loops,
  // so a consumer takes the actions by name.
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
    // Only this place knows the two keys. `missingPaths` holds resource identities,
    // a **Sub-resource path** included. `uploadedPaths` holds files, what the user
    // supplied. One `.tres` behind three materials clears three missing rows and
    // shows one uploaded row.
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

  /** Takes a file, the key `markUploaded` stored. */
  const removeUploaded = useCallback((path: string) => {
    if (!path) return;
    setUploadedPaths((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
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

  return (
    <MissingResourcesContext.Provider value={value}>
      {children}
    </MissingResourcesContext.Provider>
  );
}

export function useMissingResources(): MissingResourcesContextValue {
  return useContext(MissingResourcesContext);
}
