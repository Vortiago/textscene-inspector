/**
 * Bulk fixture lint guard: every shipped scene file must lint clean.
 *
 * This turns the manual `pnpm lint:tscn scenes/fixtures/*.tscn
 * scenes/examples/*.tscn` sweep into an always-on test. Positive fixtures
 * and examples must produce zero error-severity diagnostics (warnings are
 * allowed — some scenes intentionally carry advisory warnings). Negative
 * `edge-*` fixtures listed in EDGE_FIXTURES_WITH_ERRORS must produce at
 * least one error, pinning that the rules they exist to trigger actually
 * fire — the gap class where a rule exists but its fixture silently stops
 * exercising it.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Linter } from './Linter.js';
import './index.js';

const here = dirname(fileURLToPath(import.meta.url)); // .../packages/textscene-core/src/linter
const scenesRoot = resolve(here, '../../../../scenes');

/**
 * Negative lint fixtures: each must produce ≥1 error. Other `edge-*` files
 * are rendering edge cases (lenient-parser recovery, transform corner
 * cases) and must lint clean like every positive fixture. Adding a new
 * negative fixture? Add it here, or this guard fails it as a positive.
 */
const EDGE_FIXTURES_WITH_ERRORS = new Set([
  'edge-invalid-cast-shadow.tscn',
  'edge-invalid-transform.tscn',
  'edge-malformed-bracket.tscn',
  'edge-photo-wall.tscn',
  'edge-tilemap-bad-tile-data.tscn',
]);

function tscnFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.tscn'))
    .sort();
}

function lintFile(dir: string, file: string): { errors: number; messages: string[] } {
  const linter = new Linter();
  const diagnostics = linter.lint(readFileSync(join(dir, file), 'utf8'));
  const errors = diagnostics.filter((d) => d.severity === 'error');
  return {
    errors: errors.length,
    messages: errors.map((e) => `${file}: ${e.message}`),
  };
}

describe('shipped scenes lint clean (bulk fixture guard)', () => {
  const fixturesDir = join(scenesRoot, 'fixtures');
  const examplesDir = join(scenesRoot, 'examples');

  it('finds the scenes directories (path layout guard)', () => {
    expect(tscnFiles(fixturesDir).length).toBeGreaterThan(0);
    expect(tscnFiles(examplesDir).length).toBeGreaterThan(0);
  });

  it('every positive fixture produces zero error diagnostics', () => {
    const failures: string[] = [];
    for (const file of tscnFiles(fixturesDir)) {
      if (EDGE_FIXTURES_WITH_ERRORS.has(file)) continue;
      failures.push(...lintFile(fixturesDir, file).messages);
    }
    expect(failures).toEqual([]);
  });

  it('every example scene produces zero error diagnostics', () => {
    const failures: string[] = [];
    for (const file of tscnFiles(examplesDir)) {
      failures.push(...lintFile(examplesDir, file).messages);
    }
    expect(failures).toEqual([]);
  });

  it('every negative edge fixture still produces at least one error (rules fire)', () => {
    const silent: string[] = [];
    for (const file of EDGE_FIXTURES_WITH_ERRORS) {
      if (lintFile(fixturesDir, file).errors === 0) {
        silent.push(file);
      }
    }
    expect(silent).toEqual([]);
  });

  it('EDGE_FIXTURES_WITH_ERRORS only lists files that exist', () => {
    const existing = new Set(tscnFiles(fixturesDir));
    const stale = [...EDGE_FIXTURES_WITH_ERRORS].filter((f) => !existing.has(f));
    expect(stale).toEqual([]);
  });
});
