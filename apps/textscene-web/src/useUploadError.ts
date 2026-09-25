/**
 * The toolbar's single error banner, fed by two independent channels.
 */

import { useState } from 'react';
import { nextErrorSequence } from './errorSequence';
import type { LoadError } from './useSceneSource';

export interface UploadErrorChannel {
  /** Whichever of the two channels was set most recently and is still live. */
  effectiveError: string | null;
  reportUploadError: (message: string) => void;
  clearUploadError: () => void;
}

/** An unreadable file, or no .tscn among the dropped or selected files. */
interface UploadError {
  readonly message: string;
  readonly sequence: number;
}

/**
 * Upload errors here and `useSceneSource`'s `loadError` feed one banner, which shows the one
 * set most recently. An edit clears both, a fixture switch the upload one, `replace()` the
 * `loadError`. The next successful upload, fixture switch or edit clears an upload error.
 */
export function useUploadError(loadError: LoadError | null): UploadErrorChannel {
  const [uploadError, setUploadError] = useState<UploadError | null>(null);

  // Ordered by the sequence each error took when it was set, never by when it rendered: a
  // fetch rejection and a later drop can render in either order, in one batch or two.
  const newest =
    uploadError !== null && (loadError === null || uploadError.sequence > loadError.sequence)
      ? uploadError
      : loadError;

  return {
    effectiveError: newest?.message ?? null,
    reportUploadError: (message: string) =>
      setUploadError({ message, sequence: nextErrorSequence() }),
    clearUploadError: () => setUploadError(null),
  };
}
