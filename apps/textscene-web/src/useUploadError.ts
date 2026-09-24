/**
 * The toolbar's single error banner, fed by two independent channels.
 */

import { useEffect, useState } from 'react';
import type { LoadError } from './useSceneSource';

export interface UploadErrorChannel {
  /** Whichever of the two channels was set most recently and is still live. */
  effectiveError: string | null;
  reportUploadError: (message: string) => void;
  clearUploadError: () => void;
}

/**
 * Upload errors here and `useSceneSource`'s `loadError` feed one banner, which shows the one
 * set most recently. A fixture fetch can reject after an upload error, so the set order is
 * tracked. An edit clears both, a fixture switch the upload one, `replace()` the `loadError`.
 */
export function useUploadError(loadError: LoadError | null): UploadErrorChannel {
  // An unreadable file, or no .tscn among the dropped or selected files. The next successful
  // upload, fixture switch or edit clears it.
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [newestErrorChannel, setNewestErrorChannel] = useState<'upload' | 'load'>('upload');
  // Keyed on the failure, not its message: a retry that fails the same way must still mark
  // the load channel newest, and React can batch away the null render between the two.
  useEffect(() => {
    if (loadError !== null) setNewestErrorChannel('load');
  }, [loadError]);

  // When the newest channel is clear, the other one shows if it is live.
  const loadMessage = loadError?.message ?? null;
  const effectiveError =
    newestErrorChannel === 'load' ? (loadMessage ?? uploadError) : (uploadError ?? loadMessage);

  return {
    effectiveError,
    reportUploadError: (message: string) => {
      setUploadError(message);
      setNewestErrorChannel('upload');
    },
    clearUploadError: () => setUploadError(null),
  };
}
