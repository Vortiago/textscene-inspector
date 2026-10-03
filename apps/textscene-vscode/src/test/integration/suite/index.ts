/** Mocha setup for the integration tests. */
import { runSuite } from '../../mochaSuite';

/**
 * The launcher populates the test workspace, not this: the window has already
 * resolved its workspace folder (`integrationLaunch.ts`).
 */
export function run(): Promise<void> {
  return runSuite(__dirname);
}
