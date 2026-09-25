/** Mocha setup for the integration tests. */
import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

/**
 * The launcher populates the test workspace, not this: the window has already
 * resolved its workspace folder (`integrationLaunch.ts`).
 */
export async function run(): Promise<void> {
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
