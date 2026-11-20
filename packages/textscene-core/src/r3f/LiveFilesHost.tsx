import { useSyncExternalStore } from 'react';
import { useResourceLoader } from '../resources/useResource.js';
import { hasUnsettledFile } from '../resources/useLoadedFiles.js';
import { usePendingWhile } from '../resources/usePendingWhile.js';
import { liveFilesOf } from './liveFiles.js';

export function LiveFilesHost(): null {
  const loader = useResourceLoader();
  const live = liveFilesOf(loader);
  // Renders again whenever the files may have changed, so the pending work below reads them anew.
  useSyncExternalStore(live.subscribeFiles, live.filesVersion, live.filesVersion);
  usePendingWhile(loader !== null && hasUnsettledFile(live.files()));
  return null;
}
