/** The argument contract: which sides to render, and which images. */

import { parseCaptureFlags } from '../captureFlags.mjs';

/** The shared side and `--only` flags alone: every committed image re-renders, so no `--force`. */
export function parseArgs(argv) {
  return parseCaptureFlags(argv);
}
