/**
 * The missing and uploaded paths of a whole preview shell, for one panel. A
 * context, not an event subscription: each consumer knows its address is
 * needed and reports it through `useMissingReport`. With no provider the
 * actions do nothing and the sets are empty, so a hook calls `report` without
 * a null check.
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
import { useCountedReports } from '../hooks/useCountedReports.js';
import { withKey, withoutKey } from '../../utils/keySet.js';
import type { ResourceStatus } from '../../resources/useResource.js';

export interface MissingResourcesContextValue {
  /** Paths the dispatcher's resource hooks currently report as missing. */
  missingPaths: ReadonlySet<string>;
  /** Paths the user uploaded a file for through `addUploadedFile`. */
  uploadedPaths: ReadonlySet<string>;
  /** `useMissingReport` calls it when the status becomes `'unavailable'`. Each call needs its own `clear`. */
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
  // Several slots can consume one path, so it stays missing while any of them reports it. An effect
  // on the whole context object loops, so a consumer takes the actions by name.
  const { reported: missingPaths, report, clear, clearAll } = useCountedReports();
  const [uploadedPaths, setUploadedPaths] = useState<ReadonlySet<string>>(() => new Set<string>());

  const markUploaded = useCallback(
    (path: string) => {
      if (!path) return;
      // Only this place knows the two keys. `missingPaths` holds resource identities,
      // a **Sub-resource path** included. `uploadedPaths` holds files, what the user
      // supplied. One `.tres` behind three materials clears three missing rows and
      // shows one uploaded row.
      setUploadedPaths((prev) => withKey(prev, resourceFilePath(path)));
      // An upload heals every consumer of the path at once, so all its reports go.
      clearAll(path);
    },
    [clearAll]
  );

  /** Takes a file, the key `markUploaded` stored. */
  const removeUploaded = useCallback((path: string) => {
    if (!path) return;
    setUploadedPaths((prev) => withoutKey(prev, path));
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

export function useMissingResources(): MissingResourcesContextValue {
  return useContext(MissingResourcesContext);
}

/**
 * Keeps `address` in `missingPaths` while `status` is `unavailable`. An address that loads after
 * this hook reported it was uploaded, so its row stays, marked uploaded, and keeps its Remove
 * control. An address that loads on first request never shows a row.
 */
export function useMissingReport(address: string, status: ResourceStatus): void {
  const { report, clear, markUploaded } = useMissingResources();
  const reportedAddressRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === 'unavailable') {
      report(address);
      reportedAddressRef.current = address;
      return () => clear(address);
    }
    // The cleanup above already withdrew this hook's report, so a load clears nothing here.
    if (status === 'loaded' && reportedAddressRef.current === address) {
      markUploaded(address);
      reportedAddressRef.current = null;
    }
    return undefined;
  }, [address, status, report, clear, markUploaded]);
}
