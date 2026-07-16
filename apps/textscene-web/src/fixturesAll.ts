/**
 * The full fixture set the previewer renders: the committed base manifest
 * (./fixtures, generated) PLUS any on-demand, gitignored corpora — e.g. the
 * open-source games (./fixtures.games, written by `pnpm vendor:games`) and the
 * optional author-only ld-58 project (./fixtures.ld58, `pnpm vendor:ld58`).
 *
 * Optional corpora are fetched on demand, not committed, so their manifests
 * may not exist. Every manifest exports the same conventional `corpusFixtures`
 * name (written by generate-fixtures.js), so ONE wildcard glob merges them
 * all — a new corpus needs no change here. `import.meta.glob` resolves to an
 * empty set when a file is absent (fresh clone / CI), so the app simply shows
 * no vendored scenes until they're vendored — no drift in the committed
 * manifest, no broken imports.
 *
 * Runtime consumers import `fixtures` from HERE; the generated `./fixtures`
 * stays a plain base-only manifest (kept JSON-parseable for the showcase
 * tooling that reads it as text).
 */
import { warn } from '@textscene/core';
import { fixtures as baseFixtures, type Fixture } from './fixtures';

const corpusModules = import.meta.glob<{ corpusFixtures?: Fixture[] }>(
  ['./fixtures.*.ts', '!./*.test.ts'],
  { eager: true }
);
const corpusFixtures: Fixture[] = Object.entries(corpusModules).flatMap(([path, m]) => {
  if (!m.corpusFixtures) {
    // A manifest written by an older generator (different export name) would
    // otherwise vanish silently — make the stale-manifest case loud.
    warn(
      `[Fixtures] ${path} matched the corpus-manifest glob but exports no ` +
        "'corpusFixtures' — regenerate it with `pnpm generate:fixtures` (or re-run the vendor script)."
    );
    return [];
  }
  return m.corpusFixtures;
});

export const fixtures: Fixture[] = [...baseFixtures, ...corpusFixtures];
