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

/** Each file that failed first and then loaded, kept across scenes until removed, and the removal. */
function useUploadedPaths(files: readonly SceneFile[]): [ReadonlySet<string>, (path: string) => void] {
  const [uploadedPaths, setUploadedPaths] = useState<ReadonlySet<string>>(() => new Set<string>());
  const seenMissing = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const arrived = files.filter((file) => file.state === 'loaded' && seenMissing.current.has(file.path));
    // A file loads again after a change, so one seen missing stays seen while it loads.
    const stillMissing = files.filter(
      (file) => failsItself(file) || (file.state === 'loading' && seenMissing.current.has(file.path))
    );
    seenMissing.current = new Set(stillMissing.map((file) => file.path));
    if (arrived.length === 0) return;
    setUploadedPaths((prev) => arrived.reduce((next, { path }) => withKey(next, path), prev));
  }, [files]);
  const removeUploaded = useCallback(
    (path: string) => setUploadedPaths((prev) => withoutKey(prev, path)),
    []
  );
  return [uploadedPaths, removeUploaded];
}

/** The file an upload replaces: a file that fails through another loads once that one arrives. */
function failsItself({ path, state, reason }: SceneFile): boolean {
  return state === 'missing' && reason?.chain.at(-1) === path;
}
