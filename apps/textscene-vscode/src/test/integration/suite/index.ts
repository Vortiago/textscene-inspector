/** Mocha setup for the integration tests. */
import * as fs from 'fs';
import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';
import { SUITE_STARTED_MARKER_ENV } from '../integrationLaunch';

/**
 * The launcher populates the test workspace, not this: the window has already
 * resolved its workspace folder (`integrationLaunch.ts`).
 */
export async function run(): Promise<void> {
  markSuiteStarted();
  const mocha = new Mocha({
    ui: 'tdd', // suite() and test()
    color: true,
    timeout: 20000,
  });

  const testsRoot = __dirname;

  return new Promise((resolve, reject) => {
    glob('**/**.test.js', { cwd: testsRoot })
      .then((files) => {
        files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

        try {
          mocha.run((failures) => {
            if (failures > 0) {
              reject(new Error(`${failures} tests failed.`));
            } else {
              resolve();
            }
          });
        } catch (err) {
          console.error(err);
          reject(err);
        }
      })
      .catch((err) => {
        reject(err);
      });
  });
}

/** Tells the launcher that a test may run from here on, so it never relaunches. */
function markSuiteStarted(): void {
  const marker = process.env[SUITE_STARTED_MARKER_ENV];
  if (marker) fs.writeFileSync(marker, '');
}
