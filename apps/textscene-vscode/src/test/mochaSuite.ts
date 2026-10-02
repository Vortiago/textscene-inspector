/** The mocha run that each extension host suite's `run()` hands its own directory to. */
import * as fs from 'fs';
import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';
import { SUITE_STARTED_MARKER_ENV } from './integration/integrationLaunch';

/** Runs every `*.test.js` under `testsRoot`, and rejects when a test fails. */
export async function runSuite(testsRoot: string): Promise<void> {
  markSuiteStarted();
  const mocha = new Mocha({
    ui: 'tdd', // suite() and test()
    color: true,
    timeout: 20000,
  });

  const files = await glob('**/**.test.js', { cwd: testsRoot });
  files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
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
