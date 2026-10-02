/** Mocha setup for the installed-package suite. */
import { runSuite } from '../../mochaSuite';

export function run(): Promise<void> {
  return runSuite(__dirname);
}
