/**
 * Run a committed `unit-*.tscn` through the REAL strict parser from a slice test.
 *
 * A slice's fixture carries a claim: it lints with zero errors and zero warnings.
 * The gate that owns that claim, `fixtureLint`, imports `linter/index.ts` and so
 * loads every slice in the repo, which makes it unusable while sibling slices are
 * being written concurrently. Faced with that, slice authors started RE-DERIVING
 * the claim by hand: locating the node heading with `indexOf`, splitting lines,
 * and pushing each one through `findValidator`. That duplicates the scanning loop
 * it means to exercise, so it can agree with a broken parser.
 *
 * This runs `StrictTscnParser` itself, and deliberately does NOT import the
 * barrel or `Linter`, so it stays available mid-wave.
 *
 * What it proves and what it does not: only the registrations the calling test
 * has imported are live, so a clean result means "nothing my slice registers
 * rejects this file". Diagnostics from rules, and from types this test never
 * imported, are out of scope by construction. `fixtureLint` remains the gate for
 * the whole-registry claim; this is the part an author can actually run.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { StrictTscnParser } from '../StrictTscnParser.js';
import type { ParseError } from '../types.js';

/** `src/linter/testing` up to the repo root, then down to the committed fixtures. */
const FIXTURES_DIR = join(import.meta.dirname, '../../../../..', 'scenes/fixtures');

/** Read a committed fixture by bare filename, e.g. `unit-popup-panel.tscn`. */
export function readFixture(fixtureFile: string): string {
  return readFileSync(join(FIXTURES_DIR, fixtureFile), 'utf8');
}

/**
 * Every diagnostic the strict parser reports for a committed fixture.
 *
 * `ParseError.severity` spans both tiers, so this is errors AND warnings in one
 * list; that is why the assertion below can cover both at once.
 */
export function fixtureDiagnostics(fixtureFile: string): ParseError[] {
  return new StrictTscnParser().parse(readFixture(fixtureFile)).errors;
}

/**
 * Assert a fixture draws no diagnostic from whatever the calling test imported.
 *
 * Fails with the offending `key = value` lines rather than a bare count, because
 * "the fixture is dirty" is not actionable and "line 12, `size`, must be >= 2" is.
 */
export function expectFixtureClean(fixtureFile: string): void {
  const found = fixtureDiagnostics(fixtureFile).map(
    (d) => `${fixtureFile}:${d.line} [${d.severity}] ${d.code}: ${d.message}`
  );
  expect(found, `${fixtureFile} must carry only values Godot accepts`).toEqual([]);
}
