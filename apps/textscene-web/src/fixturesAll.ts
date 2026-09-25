/**
 * The fixture set the previewer renders: the generated ./fixtures and the gitignored
 * corpora, such as ./fixtures.games (`pnpm vendor:games`) and ./fixtures.ld58
 * (ADR-0033). Runtime code imports from here, since ./fixtures stays base-only and
 * JSON-parseable for the showcase tooling.
 */
import { warn } from '@textscene/core';
import { fixtures as baseFixtures, type Fixture } from './fixtures';
import { IS_PUBLIC_SITE } from './siteEdition';

/**
 * The games corpus is deploy-only: `pnpm build:deploy` sets the flag, and
 * `copy-fixtures.js` gates its mirror on it too. It controls visibility, not bundle
 * size: the eager glob imports every manifest, and the filter drops entries.
 */
const INCLUDE_GAMES = import.meta.env.VITE_INCLUDE_GAMES === '1';

// Every manifest exports `corpusFixtures` (generate-fixtures.js), so one glob merges
// them and a new corpus needs no change here. An absent manifest (a fresh clone, CI)
// resolves to nothing, so no import breaks.
const corpusModules = import.meta.glob<{ corpusFixtures?: Fixture[] }>(
  ['./fixtures.*.ts', '!./*.test.ts'],
  { eager: true }
);
const corpusFixtures: Fixture[] = Object.entries(corpusModules).flatMap(([path, m]) => {
  if (!INCLUDE_GAMES && path.includes('.games.')) return [];
  if (!m.corpusFixtures) {
    // A manifest from an older generator, with another export name, warns rather
    // than vanishing.
    warn(
      `[Fixtures] ${path} matched the corpus-manifest glob but exports no ` +
        "'corpusFixtures' — regenerate it with `pnpm generate:fixtures` (or re-run the vendor script)."
    );
    return [];
  }
  return m.corpusFixtures;
});

// The public edition lists nothing, and Rollup then drops every manifest from its bundle.
export const fixtures: Fixture[] = IS_PUBLIC_SITE ? [] : [...baseFixtures, ...corpusFixtures];
