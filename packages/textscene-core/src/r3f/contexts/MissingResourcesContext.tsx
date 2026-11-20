/**
 * The previewer's resource file rows: the scene's missing files, and the files the user
 * uploaded. A file the scene gave as missing that loads later was uploaded.
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
  const missingFiles = useMemo(() => files.filter((file) => file.state === 'missing'), [files]);
  const [uploadedPaths, removeUploaded] = useUploadedPaths(files);
  const value = useMemo<MissingResourcesContextValue>(
    () => ({ missingFiles, uploadedPaths, removeUploaded }),
    [missingFiles, uploadedPaths, removeUploaded]
  );

  return <MissingResourcesContext.Provider value={value}>{children}</MissingResourcesContext.Provider>;
}

export function useMissingResources(): MissingResourcesContextValue {
  return useContext(MissingResourcesContext);
}

/** Each file that turned from `missing` to `loaded` while the scene names it, and the removal of one. */
function useUploadedPaths(files: readonly SceneFile[]): [ReadonlySet<string>, (path: string) => void] {
  const [uploadedPaths, setUploadedPaths] = useState<ReadonlySet<string>>(() => new Set<string>());
  const seenMissing = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const named = new Set(files.map((file) => file.path));
    const arrived = files.filter((file) => file.state === 'loaded' && seenMissing.current.has(file.path));
    seenMissing.current = new Set(files.filter((file) => file.state === 'missing').map((file) => file.path));
    setUploadedPaths((prev) => {
      let next = prev;
      for (const path of prev) if (!named.has(path)) next = withoutKey(next, path);
      for (const { path } of arrived) next = withKey(next, path);
      return next;
    });
  }, [files]);
  const removeUploaded = useCallback(
    (path: string) => setUploadedPaths((prev) => withoutKey(prev, path)),
    []
  );
  return [uploadedPaths, removeUploaded];
}
