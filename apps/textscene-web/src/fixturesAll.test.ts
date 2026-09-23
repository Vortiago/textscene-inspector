/**
 * fixturesAll merges the committed base manifest with the gitignored games
 * (`pnpm vendor:games`) and ld-58 (`pnpm vendor:ld58`) corpora. Unvendored, the glob
 * finds nothing and the merge equals the base, so this holds on any runner.
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
   * Only `pnpm build:deploy` sets `VITE_INCLUDE_GAMES=1`. This asserts the default
   * arm a developer runs, with or without the corpus vendored. `copy-fixtures.js`
   * gates its mirror on the same variable, or the selector lists scenes whose files
   * were never copied.
   */
  it('excludes the games corpus unless VITE_INCLUDE_GAMES is set', () => {
    expect(import.meta.env.VITE_INCLUDE_GAMES).not.toBe('1');
    expect(merged.some((f) => f.file.startsWith('games/'))).toBe(false);
  });
});
