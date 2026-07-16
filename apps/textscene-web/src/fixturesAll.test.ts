/**
 * fixturesAll merges the committed base manifest with the on-demand games
 * corpus (gitignored, fetched via `pnpm vendor:games`) and the optional
 * author-only ld-58 corpus (gitignored, vendored via `pnpm vendor:ld58`). When
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
});
