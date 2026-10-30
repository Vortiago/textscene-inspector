/** Test-only: lets the loads a render started finish, so the scene a test reads holds what they bring. */

import ReactThreeTestRenderer from '@react-three/test-renderer';

/**
 * The fake loader answers from its seeded cache through promises alone, and a timer fires only after
 * the microtask queue is empty, so one timer tick sees every load done, however slow the machine.
 * The in-thread job runner loads the jobs module on its first job, a load that outlasts a tick on a
 * cold module cache, so it is awaited here first.
 *
 * @canonical In tests, the loads a render started
 */
export async function settleLoads(): Promise<void> {
  await import('../../workers/jobs');
  await ReactThreeTestRenderer.act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve));
  });
}
