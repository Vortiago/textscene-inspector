/**
 * The documents of the repository name an owner for each scope cut. `isScopeCutDocument` says
 * which files those are.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../repoRoot.mjs';
import { isKnownUnownedCut, KNOWN_UNOWNED_CUTS } from './knownUnownedCuts.mjs';
import { isScopeCutDocument, unownedScopeCuts } from './scopeCuts.mjs';

function documentPaths() {
  const underDocs = readdirSync(join(REPO_ROOT, 'docs'), { recursive: true }).map((name) =>
    join('docs', name)
  );
  return [...readdirSync(REPO_ROOT), ...underDocs].filter(isScopeCutDocument).sort();
}

/** Each unowned cut of the documents, with its path and its first line. */
function unownedCutsOfDocuments() {
  return documentPaths().flatMap((path) =>
    unownedScopeCuts(readFileSync(join(REPO_ROOT, path), 'utf8')).map(({ text }) => ({ path, text }))
  );
}

describe('the documents of the repository', () => {
  const unowned = unownedCutsOfDocuments();

  it('name an issue, or "no issue:" with a reason, beside each line that puts work off', () => {
    const unknown = unowned.filter((cut) => !isKnownUnownedCut(cut));

    expect(unknown.map(({ path, text }) => `${path}: ${text}`)).toEqual([]);
  });

  it('hold every cut of KNOWN_UNOWNED_CUTS, so an entry goes when its line gets an owner', () => {
    const isHeld = (known) =>
      unowned.some(({ path, text }) => path === known.path && text.startsWith(known.startsWith));

    expect(KNOWN_UNOWNED_CUTS.filter((known) => !isHeld(known))).toEqual([]);
  });

  it('give each entry of KNOWN_UNOWNED_CUTS its reason', () => {
    expect(KNOWN_UNOWNED_CUTS.filter(({ reason }) => reason.trim() === '')).toEqual([]);
  });
});
