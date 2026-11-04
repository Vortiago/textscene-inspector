/** The mocha run that each extension host suite's `run()` hands its own directory to. */
import * as fs from 'fs';
import * as path from 'path';
import { globSync } from 'glob';
import Mocha from 'mocha';
import { SUITE_RESULT_FILE_ENV, SUITE_STARTED_MARKER_ENV } from './integration/integrationLaunch';

/** Runs every `*.test.js` under `testsRoot`, and rejects when a test fails. */
export async function runSuite(testsRoot: string): Promise<void> {
  markSuiteStarted();
  const mocha = new Mocha({
    ui: 'tdd', // suite() and test()
    color: true,
    timeout: 20000,
  });

  // Joined to `testsRoot`, not `absolute: true`: glob uppercases a Windows drive letter, and the
  // tests compare `__dirname` paths with the lowercase `Uri.fsPath`. Sorted: glob has no fixed order.
  globSync('**/*.test.js', { cwd: testsRoot })
    .sort()
    .forEach((file) => mocha.addFile(path.join(testsRoot, file)));

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      recordFailures(failures);
      if (failures > 0) {
        reject(new Error(`${failures} tests failed.`));
      } else {
        resolve();
      }
    });
  });
}

/** Tells the launcher that a test may run from here on, so it never relaunches. */
function markSuiteStarted(): void {
  const marker = process.env[SUITE_STARTED_MARKER_ENV];
  if (marker) fs.writeFileSync(marker, '');
}

/** Tells the launcher how many tests failed, for an editor whose exit code hides it. */
function recordFailures(failures: number): void {
  const file = process.env[SUITE_RESULT_FILE_ENV];
  if (file) fs.writeFileSync(file, String(failures));
}
