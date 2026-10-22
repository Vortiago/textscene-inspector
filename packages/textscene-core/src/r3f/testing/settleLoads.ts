/** Test-only: lets the loads a render started finish, so the scene a test reads holds what they bring. */

import ReactThreeTestRenderer from '@react-three/test-renderer';

/** The fake loader answers from its seeded cache, so a load ends within a few microtasks. The wait is a margin, not a measured time. */
const LOAD_SETTLE_MS = 10;

export async function settleLoads(): Promise<void> {
  await ReactThreeTestRenderer.act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, LOAD_SETTLE_MS));
  });
}
