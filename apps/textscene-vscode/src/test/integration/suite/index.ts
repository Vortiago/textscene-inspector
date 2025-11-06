/**
 * Mocha test suite setup for integration tests.
 */
import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';
import { setupTestWorkspace } from '../setupWorkspace';

export async function run(): Promise<void> {
  // Setup test workspace before running tests
  const workspaceRoot = path.resolve(__dirname, '../../../../.test-workspace');
  setupTestWorkspace(workspaceRoot);

  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd', // Use TDD interface for suite() and test()
    color: true,
    timeout: 20000, // 20 seconds for integration tests
  });

  const testsRoot = __dirname;

  return new Promise((resolve, reject) => {
    // Find all test files
    glob('**/**.test.js', { cwd: testsRoot })
      .then((files) => {
        // Add files to the test suite
        files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

        try {
          // Run the mocha test
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
