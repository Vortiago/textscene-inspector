/**
 * fixturesAll merges the committed base manifest with the on-demand games
 * corpus (gitignored, fetched via `pnpm vendor:games`) and the optional
 * deploy-included ld-58 corpus (gitignored, vendored via `pnpm vendor:ld58`). When
 * neither has been vendored, import.meta.glob resolves to nothing and the merged
 * set equals the base — so this holds whether or not either is present on the
 * test runner.
 */

import { describe, expect, it } from 'vitest';
import { fixtures as merged } from './fixturesAll';
import { fixtures as base } from './fixtures';

describe('fixturesAll', () => {
  it('contains at least the committed base manifest', () => {
    expect(merged.length).toBeGreaterThanOrEqual(base.length);
    for (const b of base) {
      expect(merged.some((m) => m.file === b.file && m.name === b.name)).toBe(true);
    }
  });

  it('exposes well-formed entries (base + any vendored games)', () => {
    for (const f of merged) {
      expect(typeof f.name).toBe('string');
      expect(typeof f.file).toBe('string');
      expect(typeof f.category).toBe('string');
    }
  });

  /**
   * The games corpus is DEPLOY-ONLY: `pnpm build:deploy` sets
   * `VITE_INCLUDE_GAMES=1`, `pnpm dev` and a plain build do not. This asserts
   * the DEFAULT arm, which is the one a developer runs — and it holds whether
   * or not the corpus happens to be vendored on this machine, which matters
   * because verifying this feature against the real RTS scenes requires
   * vendoring it.
   *
   * `copy-fixtures.js` gates the matching `public/fixtures/games/` mirror on
   * the same variable. If these two ever disagree the selector lists scenes
   * whose files were never copied, which reads to the user as a broken app
   * rather than a missing corpus.
   */
  it('excludes the games corpus unless VITE_INCLUDE_GAMES is set', () => {
    expect(import.meta.env.VITE_INCLUDE_GAMES).not.toBe('1');
    expect(merged.some((f) => f.file.startsWith('games/'))).toBe(false);
  });
});
