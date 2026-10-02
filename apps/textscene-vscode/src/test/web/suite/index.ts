/**
 * Mocha setup for the web suite. The web extension host loads this bundle in a browser
 * worker, which has no file system to glob, so it imports each test file by name.
 */
/* global mocha -- the browser build of mocha, imported below, sets it. */
import 'mocha/mocha.js';

export async function run(): Promise<void> {
  // Spec, not the browser default HTML reporter: a worker has no DOM to draw in.
  mocha.setup({ ui: 'tdd', reporter: 'spec', timeout: 20000 });
  // After setup, which defines the suite() and test() globals the file calls.
  await import('./web.test');

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
