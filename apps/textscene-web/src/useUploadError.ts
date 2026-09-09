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
 * Two error channels owned by different layers (upload errors here, `loadError`
 * inside `useSceneSource`) feed one toolbar banner, which must show whichever
 * was set most recently. Value order can't encode that — an in-flight fixture
 * fetch can reject AFTER an upload error was set — so set-order is tracked
 * explicitly: `reportUploadError` bumps the channel, and the effect below
 * records a fetch error's arrival.
 *
 * Each error is cleared by the interactions that supersede it: edits clear
 * both, fixture switches clear the upload one, `replace()` clears `loadError`.
 */
export function useUploadError(loadError: string | null): UploadErrorChannel {
  // Upload-path errors (unreadable file, no .tscn among the dropped/selected
  // files). Distinct from `loadError`, which useSceneSource owns for fixture
  // fetches; cleared on the next successful upload, fixture switch, or edit.
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [newestErrorChannel, setNewestErrorChannel] = useState<'upload' | 'load'>('upload');
  useEffect(() => {
    if (loadError !== null) setNewestErrorChannel('load');
  }, [loadError]);

  // If the newest channel has since been cleared, the other one — if still
  // live — shows instead.
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
