/**
 * Prints the shared helpers of the repo, one job a line, from the `@canonical` tags in the `src/` of
 * every workspace package and in `scripts/`. The list lives only here, so it never goes stale: pipe
 * it to grep to find a helper for a job.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../repoRoot.mjs';
import { isTestSuite, readImporters } from '../sourceTree.mjs';
import { workspacePackages } from '../workspace.mjs';
import { canonicalEntries, renderCanonicalList } from './canonicalTags.mjs';

function packageSources() {
  return workspacePackages()
    .map((dir) => join(dir, 'src'))
    .filter((src) => existsSync(src));
}

function taggedEntries() {
  const files = readImporters(REPO_ROOT, [...packageSources(), join(REPO_ROOT, 'scripts')]);
  return [...files]
    .filter(([path]) => !isTestSuite(path))
    .flatMap(([path, text]) => canonicalEntries(text, path));
}

process.stdout.write(renderCanonicalList(taggedEntries()));
