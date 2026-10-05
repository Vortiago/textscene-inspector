/** Mocha setup for the second installed-package launch, in which the agent tools are off. */
import { runSuite } from '../../mochaSuite';

export function run(): Promise<void> {
  return runSuite(__dirname);
}
