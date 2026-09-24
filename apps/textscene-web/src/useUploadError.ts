/**
 * The toolbar's single error banner, fed by two independent channels.
 */

import { useEffect, useState } from 'react';

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
export function useUploadError(loadError: string | null): UploadErrorChannel {
  // An unreadable file, or no .tscn among the dropped or selected files. The next successful
  // upload, fixture switch or edit clears it.
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [newestErrorChannel, setNewestErrorChannel] = useState<'upload' | 'load'>('upload');
  useEffect(() => {
    if (loadError !== null) setNewestErrorChannel('load');
  }, [loadError]);

  // When the newest channel is clear, the other one shows if it is live.
  const effectiveError =
    newestErrorChannel === 'load' ? (loadError ?? uploadError) : (uploadError ?? loadError);

  return {
    effectiveError,
    reportUploadError: (message: string) => {
      setUploadError(message);
      setNewestErrorChannel('upload');
    },
    clearUploadError: () => setUploadError(null),
  };
}
