/** The mocha run that each extension host suite's `run()` hands its own directory to. */
import * as fs from 'fs';
import * as path from 'path';
import Mocha from 'mocha';
import { SUITE_STARTED_MARKER_ENV } from './integration/integrationLaunch';

/** Runs every `*.test.js` under `testsRoot`, and rejects when a test fails. */
export async function runSuite(testsRoot: string): Promise<void> {
  markSuiteStarted();
  const mocha = new Mocha({
    ui: 'tdd', // suite() and test()
    color: true,
    timeout: 20000,
  });

  testFilesUnder(testsRoot).forEach((file) => mocha.addFile(file));

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

/**
 * Every `*.test.js` path under `dir`. A plain walk, not `glob`: glob 14 needs `tracingChannel`, which the
 * Node 18.15 of the oldest supported VS Code (1.85) lacks.
 */
function testFilesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return testFilesUnder(entryPath);
    return entry.name.endsWith('.test.js') ? [entryPath] : [];
  });
}

/** Tells the launcher that a test may run from here on, so it never relaunches. */
function markSuiteStarted(): void {
  const marker = process.env[SUITE_STARTED_MARKER_ENV];
  if (marker) fs.writeFileSync(marker, '');
}
