/**
 * The full fixture set the previewer renders: the committed base manifest
 * (./fixtures, generated) PLUS any on-demand, gitignored corpora — e.g. the
 * open-source games (./fixtures.games, written by `pnpm vendor:games`) and the
 * ld-58 project (./fixtures.ld58, `pnpm vendor:ld58` — repo-external but
 * part of the deployed site, see ADR-0010).
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

/**
 * The games corpus is DEPLOY-ONLY (`pnpm build:deploy` sets the flag). A
 * developer who vendored it to verify against a real game should not thereby
 * get ~140 game scenes in their local scene selector, but the deployed site
 * does want them. `copy-fixtures.js` gates the matching `public/fixtures/games/`
 * mirror on the same variable, so the manifest and the files cannot drift.
 *
 * This controls VISIBILITY, not bundle size: `import.meta.glob({eager:true})`
 * imports every matching manifest regardless, and the filter below drops the
 * entries from the array rather than the module from the bundle.
 */
const INCLUDE_GAMES = import.meta.env.VITE_INCLUDE_GAMES === '1';

const corpusModules = import.meta.glob<{ corpusFixtures?: Fixture[] }>(
  ['./fixtures.*.ts', '!./*.test.ts'],
  { eager: true }
);
const corpusFixtures: Fixture[] = Object.entries(corpusModules).flatMap(([path, m]) => {
  if (!INCLUDE_GAMES && path.includes('.games.')) return [];
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
