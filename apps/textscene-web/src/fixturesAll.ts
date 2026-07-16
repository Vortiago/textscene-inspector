/**
 * The full fixture set the previewer renders: the committed base manifest
 * (./fixtures, generated) PLUS two on-demand, gitignored corpora — the
 * open-source games (./fixtures.games, written by `pnpm vendor:games`) and the
 * optional author-only ld-58 project (./fixtures.ld58, vendored via
 * `pnpm vendor:ld58`).
 *
 * Both are fetched on demand, not committed, so their manifests may not exist.
 * `import.meta.glob` resolves to an empty set when a file is absent (fresh clone
 * / CI), so the app simply shows no games / no ld-58 until they're vendored —
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

const ld58Modules = import.meta.glob<{ ld58Fixtures?: Fixture[] }>('./fixtures.ld58.ts', {
  eager: true,
});
const ld58Fixtures: Fixture[] = Object.values(ld58Modules).flatMap((m) => m.ld58Fixtures ?? []);

export const fixtures: Fixture[] = [...baseFixtures, ...gameFixtures, ...ld58Fixtures];
