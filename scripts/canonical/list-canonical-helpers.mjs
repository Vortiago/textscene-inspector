/**
 * Prints the shared helpers of the repo, one job a line, from the `@canonical` tags in the `src/` of
 * every workspace package and in `scripts/`. The list lives only here, so it never goes stale: pipe
 * it to grep to find a helper for a job.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../repoRoot.mjs';
import { readImporters } from '../sourceTree.mjs';
import { canonicalEntries, renderCanonicalList } from './canonicalTags.mjs';

/** The folders that hold the workspace packages, as `pnpm-workspace.yaml` lists them. */
const WORKSPACE_FOLDERS = ['packages', 'apps'];

/** A test suite holds no helper. A test kit or a file under `testing/` can, so it stays. */
const TEST_SUITE = /\.(test|spec)\.(tsx?|m?js)$/;

function packageSources() {
  return WORKSPACE_FOLDERS.flatMap((folder) =>
    readdirSync(join(REPO_ROOT, folder), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(REPO_ROOT, folder, entry.name, 'src'))
      .filter((src) => existsSync(src))
  );
}

function taggedEntries() {
  const files = readImporters(REPO_ROOT, [...packageSources(), join(REPO_ROOT, 'scripts')]);
  return [...files]
    .filter(([path]) => !TEST_SUITE.test(path))
    .flatMap(([path, text]) => canonicalEntries(text, path));
}

process.stdout.write(renderCanonicalList(taggedEntries()));
