/** Test-only: waits until every font load a peek started has settled and woken its listeners. */

import { expect, vi } from 'vitest';

/**
 * Waits on the work count a capture waits on. The channel is imported here, not at the top, so a
 * test that resets its modules waits on the instance its fresh loader counts on.
 */
export async function settleFontWork(): Promise<void> {
  const { fontWork } = await import('../controls/native/text/settledChannel');
  await vi.waitFor(() => expect(fontWork.pending()).toBe(0));
}
