/**
 * Removes a directory under the test workspace. On Windows a file that an editor or a
 * webview has just closed can still be held for a moment, so this retries. It is async,
 * and uses `fs.promises.rm`, not `rmSync`: a synchronous retry blocks the event loop, so
 * the callbacks that release the handle never run and every retry sees the same lock.
 */

import { promises as fs } from 'fs';

/** A final failure is thrown: a directory that will not go is a real problem, not a flake. */
export async function removeTestDirectory(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}
