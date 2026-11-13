/**
 * The documents of the repository name an owner for each scope cut: the ADRs, the other documents
 * under `docs/` and the documents of the root. A comparison sheet is left out, because the limit
 * lines of a sheet take their owner from the pull request body (`pnpm pr:state`).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../repoRoot.mjs';
import { KNOWN_UNOWNED_CUTS } from './knownUnownedCuts.mjs';
import { unownedScopeCuts } from './scopeCuts.mjs';

const SHEETS = 'docs/comparison';

const markdownNamesOf = (directory, options) =>
  readdirSync(join(REPO_ROOT, directory), options)
    .filter((name) => name.endsWith('.md'))
    .map((name) => join(directory, name));

function documentPaths() {
  const underDocs = markdownNamesOf('docs', { recursive: true }).filter((path) => !path.startsWith(SHEETS));
  return [...markdownNamesOf(''), ...underDocs].sort();
}

/** Each unowned cut of the documents as `<path>: <first line>`. */
function unownedCutsOfDocuments() {
  return documentPaths().flatMap((path) =>
    unownedScopeCuts(readFileSync(join(REPO_ROOT, path), 'utf8')).map(({ text }) => ({ path, text }))
  );
}

const isKnown = (cut) => (known) => known.path === cut.path && cut.text.startsWith(known.startsWith);

describe('the documents of the repository', () => {
  const unowned = unownedCutsOfDocuments();

  it('name an issue, or "no issue:" with a reason, beside each line that puts work off', () => {
    const unknown = unowned.filter((cut) => !KNOWN_UNOWNED_CUTS.some(isKnown(cut)));

    expect(unknown.map(({ path, text }) => `${path}: ${text}`)).toEqual([]);
  });

  it('hold every cut of KNOWN_UNOWNED_CUTS, so an entry goes when its line gets an owner', () => {
    const gone = KNOWN_UNOWNED_CUTS.filter((known) => !unowned.some((cut) => isKnown(cut)(known)));

    expect(gone.map(({ path, startsWith }) => `${path}: ${startsWith}`)).toEqual([]);
  });

  it('give each entry of KNOWN_UNOWNED_CUTS its reason', () => {
    expect(KNOWN_UNOWNED_CUTS.filter(({ reason }) => reason.trim() === '')).toEqual([]);
  });
});
