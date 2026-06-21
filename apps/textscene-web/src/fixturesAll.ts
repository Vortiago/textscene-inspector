/**
 * The full fixture set the previewer renders: the committed base manifest
 * (./fixtures, generated) PLUS the on-demand open-source games corpus
 * (./fixtures.games, gitignored — written by `pnpm vendor:games`).
 *
 * The games are fetched on demand, not committed, so the games manifest may not
 * exist. `import.meta.glob` resolves to an empty set when the file is absent
 * (fresh clone / CI), so the app simply shows no games until they're vendored —
 * no drift in the committed manifest, no broken imports.
 *
 * Runtime consumers import `fixtures` from HERE; the generated `./fixtures`
 * stays a plain base-only manifest (kept JSON-parseable for the showcase
 * tooling that reads it as text).
 */
import { fixtures as baseFixtures, type Fixture } from './fixtures';

const gameModules = import.meta.glob<{ gameFixtures?: Fixture[] }>('./fixtures.games.ts', {
  eager: true,
});
const gameFixtures: Fixture[] = Object.values(gameModules).flatMap((m) => m.gameFixtures ?? []);

export const fixtures: Fixture[] = [...baseFixtures, ...gameFixtures];
