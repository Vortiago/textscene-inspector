/**
 * Reads a source tree into memory, path to text, and tells a test file from a production one.
 * The test-only-export scan and the canonical helper list both read the tree this way.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import skippedDirectories from '../packages/textscene-dev-kit/skippedDirectories.json' with { type: 'json' };

const SOURCE_RE = /\.tsx?$/;
const IMPORTER_RE = /\.(tsx?|m?js)$/;
const TEST_SUITE_RE = /\.(test|spec)\.(tsx?|m?js)$/;
const TEST_KIT_RE = /\.testkit\.(tsx?|m?js)$|(^|\/)testing\//;

/** Never walked: the list `sourceScan.ts` reads, so both scans see the same files. */
const SKIPPED_DIRECTORIES = new Set(skippedDirectories);

/**
 * A test, a test kit or a file under `testing/` is a test file. Its imports prove nothing.
 *
 * @canonical Whether a script reads a file as a test file
 */
export function isTestFile(path) {
  return isTestSuite(path) || TEST_KIT_RE.test(path);
}

/**
 * A `.test` or `.spec` file is a test suite. A test kit or a file under `testing/` is not, since
 * it holds helpers that suites share.
 *
 * @canonical Whether a script reads a file as a test suite
 */
export function isTestSuite(path) {
  return TEST_SUITE_RE.test(path);
}

/**
 * Every `.ts` and `.tsx` file under `dir`, keyed by its path relative to `dir`, POSIX-style.
 *
 * @canonical A source tree read into memory by a script
 */
export function readSourceTree(dir) {
  return readFiles(dir, [dir], SOURCE_RE);
}

/**
 * Every source file under `dirs` that may import a package's tree, script files included, keyed by
 * its path relative to `root`, POSIX-style.
 *
 * @canonical A source tree read into memory by a script
 */
export function readImporters(root, dirs) {
  return readFiles(root, dirs, IMPORTER_RE);
}

function readFiles(root, dirs, nameRe) {
  const files = new Map();
  const walk = (abs) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = join(abs, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) walk(child);
      } else if (nameRe.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.set(relative(root, child).split('\\').join('/'), readFileSync(child, 'utf8'));
      }
    }
  };
  for (const dir of dirs) walk(dir);
  return files;
}
