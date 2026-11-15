/**
 * Reports the resource files the Live scene tree and its passes read: a file that fails shows as a
 * **Missing resource**, and a file still loading holds the scene's pending work. One host for each
 * provider stack, since the files are the loader's, not any one reader's.
 */

import { useSyncExternalStore } from 'react';
import { useResourceLoader } from '../resources/useResource.js';
import { hasUnsettledFile, useMissingFiles, useStableEntries } from '../resources/useLoadedFiles.js';
import { usePendingWhile } from '../resources/usePendingWhile.js';
import { liveFilesOf } from './liveFiles.js';

export function LiveFilesHost(): null {
  const loader = useResourceLoader();
  const live = liveFilesOf(loader);
  // Renders again whenever the files may have changed, so the report below reads them anew.
  useSyncExternalStore(live.subscribeFiles, live.filesVersion, live.filesVersion);
  // `files()` builds a new map on each call, so the report holds it as it is.
  const files = useStableEntries(live.files());
  useMissingFiles(files);
  usePendingWhile(loader !== null && hasUnsettledFile(files));
  return null;
}
