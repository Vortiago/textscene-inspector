import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SceneFile } from '../../scene/sceneFiles.js';
import { useOptionalHierarchy } from './HierarchyContext.js';
import { useSceneFiles } from '../hooks/useSceneFiles.js';
import { withKey, withoutKey } from '../../utils/keySet.js';

export interface MissingResourcesContextValue {
  /** The scene's files whose state is `missing`, by path. */
  missingFiles: readonly SceneFile[];
  /** Files that loaded after the scene gave them as missing. */
  uploadedPaths: ReadonlySet<string>;
  removeUploaded: (path: string) => void;
}

const NOOP: MissingResourcesContextValue = {
  missingFiles: [],
  uploadedPaths: new Set(),
  removeUploaded: () => {},
};

const MissingResourcesContext = createContext<MissingResourcesContextValue>(NOOP);
MissingResourcesContext.displayName = 'MissingResourcesContext';

export function MissingResourcesProvider({ children }: { children: ReactNode }) {
  const files = useSceneFiles(useOptionalHierarchy()?.scene);
  const missingFiles = useMissingRows(files);
  const [uploadedPaths, removeUploaded] = useUploadedPaths(files, missingFiles);
  const value = useMemo<MissingResourcesContextValue>(
    () => ({ missingFiles, uploadedPaths, removeUploaded }),
    [missingFiles, uploadedPaths, removeUploaded]
  );

  return <MissingResourcesContext.Provider value={value}>{children}</MissingResourcesContext.Provider>;
}

export function useMissingResources(): MissingResourcesContextValue {
  return useContext(MissingResourcesContext);
}

/** The missing files, each kept as it last failed while it loads again, so no row blinks out on a reload. */
function useMissingRows(files: readonly SceneFile[]): readonly SceneFile[] {
  const lastMissing = useRef<ReadonlyMap<string, SceneFile>>(new Map());
  return useMemo(() => {
    const rows = files.flatMap((file) => {
      if (file.state === 'missing') return [file];
      const last = file.state === 'loading' ? lastMissing.current.get(file.path) : undefined;
      return last ? [last] : [];
    });
    lastMissing.current = new Map(rows.map((row) => [row.path, row]));
    return rows;
  }, [files]);
}

/** Each file that failed first and then loaded, kept across scenes until removed, and the removal. */
function useUploadedPaths(
  files: readonly SceneFile[],
  missingFiles: readonly SceneFile[]
): [ReadonlySet<string>, (path: string) => void] {
  // In the render, not an effect: the missing row and its uploaded row change in one commit.
  const uploaded = useRef<ReadonlySet<string>>(new Set());
  const seenFailingItself = useRef<ReadonlySet<string>>(new Set());
  const [removals, setRemovals] = useState(0);
  const uploadedPaths = useMemo(() => {
    const arrived = files.filter(
      (file) => file.state === 'loaded' && seenFailingItself.current.has(file.path)
    );
    seenFailingItself.current = new Set(missingFiles.filter(failsItself).map((file) => file.path));
    uploaded.current = arrived.reduce((next, { path }) => withKey(next, path), uploaded.current);
    return uploaded.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `removals` is the trigger, not an input.
  }, [files, missingFiles, removals]);
  const removeUploaded = useCallback((path: string) => {
    uploaded.current = withoutKey(uploaded.current, path);
    setRemovals((count) => count + 1);
  }, []);
  return [uploadedPaths, removeUploaded];
}

/** The file an upload replaces: a file that fails through another loads once that one arrives. */
function failsItself({ path, reason }: SceneFile): boolean {
  return reason?.chain.at(-1) === path;
}
