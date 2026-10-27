/**
 * Prints the shared helpers of the core, one job a line, from the `@canonical` tags in its source.
 * The list lives only here, so it never goes stale: pipe it to grep to find a helper for a job.
 */
import { join } from 'node:path';
import { REPO_ROOT } from '../repoRoot.mjs';
import { readSourceTree } from '../sourceTree.mjs';
import { canonicalEntries, renderCanonicalList } from './canonicalTags.mjs';

const SOURCE = join(REPO_ROOT, 'packages/textscene-core/src');

function taggedEntries() {
  return [...readSourceTree(SOURCE)].flatMap(([path, text]) => canonicalEntries(text, path));
}

process.stdout.write(renderCanonicalList(taggedEntries()));
