import { useSyncExternalStore } from 'react';
import { useResourceLoader } from '../resources/useResource.js';
import { hasUnsettledFile, useStableEntries } from '../resources/useLoadedFiles.js';
import { usePendingWhile } from '../resources/usePendingWhile.js';
import { liveFilesOf } from './liveFiles.js';

export function LiveFilesHost(): null {
  const loader = useResourceLoader();
  const live = liveFilesOf(loader);
  // Renders again whenever the files may have changed, so the pending work below reads them anew.
  useSyncExternalStore(live.subscribeFiles, live.filesVersion, live.filesVersion);
  // `files()` builds a new map on each call, so the pending work holds it as it is.
  const files = useStableEntries(live.files());
  usePendingWhile(loader !== null && hasUnsettledFile(files));
  return null;
}
