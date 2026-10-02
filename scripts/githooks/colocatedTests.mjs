/**
 * The tests that sit beside a source file: `Name.test.ts` and `Name.<aspect>.test.tsx` beside
 * `Name.ts`. The pre-push hook runs them, which costs seconds. `vitest related` follows the import
 * graph instead, and one core file pulls in about 200 test files.
 */

import { readdirSync } from 'node:fs';
import { posix } from 'node:path';

const TEST = /\.test\.[cm]?[jt]sx?$/;

/** The stem a test or source file is named for: `TscnParser` for `TscnParser.perf.test.ts`. */
const stemOf = (name) => name.slice(0, name.indexOf('.'));

/**
 * The test files among `siblings` (names in the directory of `path`) that test `path`, as paths
 * beside it. A test file tests itself. A source file without tests gives an empty list.
 */
export function testsBeside(path, siblings) {
  const dir = posix.dirname(path);
  const name = posix.basename(path);
  if (TEST.test(name)) return [path];
  const stem = stemOf(name);
  return siblings
    .filter((sibling) => TEST.test(sibling) && stemOf(sibling) === stem)
    .map((sibling) => posix.join(dir, sibling));
}

/** The test files beside `path` on disk. */
export function readTestsBeside(path) {
  return testsBeside(path, readdirSync(posix.dirname(path)));
}
