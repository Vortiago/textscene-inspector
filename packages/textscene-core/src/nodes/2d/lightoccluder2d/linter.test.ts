/**
 * LightOccluder2D carries no semantic linter rules (only format validators
 * in linterParser.ts).  This file exists so the slice's linter wiring doesn't
 * require one, but it is intentionally empty of describe blocks — the
 * linterParser.test.ts covers all property-format validation.
 */

import { describe, it, expect } from 'vitest';

describe('LightOccluder2D semantic rules', () => {
  it('has no semantic rules — only format validators', () => {
    expect(true).toBe(true);
  });
});
