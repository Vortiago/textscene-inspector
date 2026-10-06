/**
 * Removes a directory under the test workspace. On Windows, VS Code can hold a file for a
 * moment after its editor or webview closes, so the removal retries. It uses `fs.promises.rm`,
 * not `rmSync`: a synchronous retry blocks the event loop, so the handle is never released.
 */

import { promises as fs } from 'fs';

/** Throws on the final failure: a directory that will not go is a real problem, not a flake. */
export async function removeTestDirectory(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}
