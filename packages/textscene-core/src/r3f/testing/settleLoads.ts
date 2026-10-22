/** Test-only: lets the loads a render started finish, so the scene a test reads holds what they bring. */

import ReactThreeTestRenderer from '@react-three/test-renderer';

const LOAD_SETTLE_MS = 10;

export async function settleLoads(): Promise<void> {
  await ReactThreeTestRenderer.act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, LOAD_SETTLE_MS));
  });
}
