/**
 * Prints the shared helpers of the repo, one job a line, from the `@canonical` tags in the `src/` of
 * every workspace package and in `scripts/`. The list lives only here, so it never goes stale: pipe
 * it to grep to find a helper for a job.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../repoRoot.mjs';
import { readImporters } from '../sourceTree.mjs';
import { workspacePackages } from '../workspace.mjs';
import { canonicalEntries, renderCanonicalList } from './canonicalTags.mjs';

/** A test suite holds no helper. A test kit or a file under `testing/` can, so it stays. */
const TEST_SUITE = /\.(test|spec)\.(tsx?|m?js)$/;

function packageSources() {
  return workspacePackages()
    .map((dir) => join(dir, 'src'))
    .filter((src) => existsSync(src));
}

function taggedEntries() {
  const files = readImporters(REPO_ROOT, [...packageSources(), join(REPO_ROOT, 'scripts')]);
  return [...files]
    .filter(([path]) => !TEST_SUITE.test(path))
    .flatMap(([path, text]) => canonicalEntries(text, path));
}

process.stdout.write(renderCanonicalList(taggedEntries()));
