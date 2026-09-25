/**
 * Runs a committed `unit-*.tscn` through the real `StrictTscnParser` from a slice
 * test, without the barrel or `Linter`, so it works while sibling slices change.
 * Only the calling test's registrations are live: a clean result means nothing
 * this slice registers rejects the file. `fixtureLint` owns the whole registry.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { StrictTscnParser } from '../StrictTscnParser.js';
import type { ParseError } from '../types.js';

/** `src/linter/testing` up to the repo root, then down to the committed fixtures. */
const FIXTURES_DIR = join(import.meta.dirname, '../../../../..', 'scenes/fixtures');

/** Read a committed fixture by bare filename, for example `unit-popup-panel.tscn`. */
export function readFixture(fixtureFile: string): string {
  return readFileSync(join(FIXTURES_DIR, fixtureFile), 'utf8');
}

/**
 * Every diagnostic the strict parser reports for a committed fixture, errors,
 * warnings and infos in one list, since `ParseError.severity` spans every tier.
 */
export function fixtureDiagnostics(fixtureFile: string): ParseError[] {
  return new StrictTscnParser().parse(readFixture(fixtureFile)).errors;
}

/**
 * Assert a fixture draws no diagnostic from whatever the calling test imported.
 * It fails with the offending lines, not a bare count, so the failure is actionable.
 */
export function expectFixtureClean(fixtureFile: string): void {
  const found = fixtureDiagnostics(fixtureFile).map(
    (d) => `${fixtureFile}:${d.line} [${d.severity}] ${d.code}: ${d.message}`
  );
  expect(found, `${fixtureFile} must carry only values Godot accepts`).toEqual([]);
}
