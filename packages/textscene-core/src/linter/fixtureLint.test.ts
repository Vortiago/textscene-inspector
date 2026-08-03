/**
 * Bulk fixture lint guard: every shipped scene file must lint clean.
 *
 * This turns the manual `pnpm lint:tscn scenes/fixtures/*.tscn
 * scenes/examples/*.tscn` sweep into an always-on test. Positive fixtures
 * and examples must produce zero error-severity diagnostics (warnings are
 * allowed — some scenes intentionally carry advisory warnings). Negative
 * `edge-*` fixtures listed in INTEGRATION_FIXTURES_WITH_ERRORS must produce at
 * least one error, pinning that the rules they exist to trigger actually
 * fire — the gap class where a rule exists but its fixture silently stops
 * exercising it.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Linter } from './Linter.js';
import type { Diagnostic } from './types.js';
import './index.js';

const here = dirname(fileURLToPath(import.meta.url)); // .../packages/textscene-core/src/linter
const scenesRoot = resolve(here, '../../../../scenes');

/**
 * `unit-*` fixtures allowed to carry advisory warnings, keyed by the EXACT rules
 * they may trip.
 *
 * A unit fixture exists to demonstrate one node configured correctly, so a
 * warning on it usually means the fixture is wrong, not the rule. The gap this
 * closes is specific: a rule shipped in the same wave as the leaves it covers
 * fires on their own fixtures, and the error-only check above stays green.
 *
 * Keyed by rule, not by filename, and asserted as SET EQUALITY. A filename-only
 * exemption would blind a fixture to every FUTURE rule too, which is the very
 * hole this exists to close - and the broad multi-node fixtures here are the
 * ones a later wave is most likely to trip.
 *
 * Add an entry only when the warning is the fixture's POINT; fixing the fixture
 * is the default.
 */
const UNIT_FIXTURE_WARNINGS: Readonly<Record<string, { rules: readonly string[]; reason: string }>> = {
  'unit-unsupported-nodes.tscn': {
    rules: ['area3d-needs-collision-shape', 'animationplayer-no-animations'],
    reason: 'exists to show unsupported types; the Area3D has no shape and the AnimationPlayer no animations on purpose',
  },
  'unit-cpuparticles2d-unpreviewable.tscn': {
    rules: [
      'cpuparticles2d-nondeterministic-emission-shape',
      'cpuparticles2d-fract-delta-ignored',
    ],
    reason: 'named for the two advisories it carries; they are the fixture',
  },
  'unit-path3d.tscn': {
    rules: ['path3d-unused'],
    reason: 'a Path3D with no follower is exactly what this fixture demonstrates',
  },
  'unit-pathfollow-3d.tscn': {
    rules: ['pathfollow3d-both-progress-properties'],
    reason: 'sets both progress properties deliberately, to pin which one wins',
  },
  'unit-instance-child.tscn': {
    rules: ['area3d-needs-collision-shape'],
    reason: "the Area3D root is a coin pickup whose shape comes from the scene that instances it; the fixture is about the instanced child's transform",
  },
  'unit-csg-combiner.tscn': {
    rules: ['staticbody3d-needs-collision-shape'],
    reason: 'the StaticBody3D holds CSG geometry rather than a CollisionShape3D; the fixture is about CSG boolean output, not collision',
  },
  'unit-animation-tree-stateless.tscn': {
    rules: ['animationtree-inactive'],
    reason: 'named for it: the tree is inactive on purpose, which is the advisory',
  },
};

/**
 * Fixtures that must produce >=1 error, and are NOT linter red tests.
 *
 * Each is an app-shell or extension INTEGRATION fixture: a selectable, really
 * broken file the VS Code integration suite opens, and that
 * `docs/user-guide-web.md` walks a user through to demonstrate the parse-error
 * banner and the recovery from it. A unit test cannot stand in for them,
 * because the thing under test is the host reacting to a file a user picked.
 *
 * A linter red test does NOT belong here: assert the validator or the rule
 * directly, which is faster and localises the failure. `edge-tilemap-bad-tile-data`
 * was the last one that did, and it went once its two rules were confirmed
 * unit-covered; `edge-invalid-transform`'s validator is now pinned in
 * `nodes/base/node3d/linterParser.test.ts`.
 *
 * The other `edge-*` files are rendering edge cases (lenient-parser recovery,
 * transform corner cases) and must lint clean like every positive fixture.
 */
const INTEGRATION_FIXTURES_WITH_ERRORS = new Set([
  'edge-invalid-cast-shadow.tscn',
  'edge-invalid-transform.tscn',
  'edge-malformed-bracket.tscn',
]);

function tscnFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.tscn'))
    .sort();
}

/** Diagnostics for one file, linted once and reused by all three sweeps below. */
const diagnosticCache = new Map<string, Diagnostic[]>();

function diagnosticsFor(dir: string, file: string): Diagnostic[] {
  const key = join(dir, file);
  let cached = diagnosticCache.get(key);
  if (!cached) {
    cached = new Linter().lint(readFileSync(key, 'utf8'));
    diagnosticCache.set(key, cached);
  }
  return cached;
}

function lintFile(dir: string, file: string): { errors: number; messages: string[] } {
  const errors = diagnosticsFor(dir, file).filter((d) => d.severity === 'error');
  return { errors: errors.length, messages: errors.map((e) => `${file}: ${e.message}`) };
}

/** Distinct warning rule names one file trips. */
function warningRulesFor(dir: string, file: string): string[] {
  return [
    ...new Set(
      diagnosticsFor(dir, file)
        .filter((d) => d.severity === 'warning')
        .map((d) => d.ruleName)
    ),
  ];
}

describe('shipped scenes lint clean (bulk fixture guard)', () => {
  const fixturesDir = join(scenesRoot, 'fixtures');
  const examplesDir = join(scenesRoot, 'examples');

  it('finds the scenes directories (path layout guard)', () => {
    expect(tscnFiles(fixturesDir).length).toBeGreaterThan(0);
    expect(tscnFiles(examplesDir).length).toBeGreaterThan(0);
  });

  it('every unit-* fixture warns only where allowlisted, rule by rule', () => {
    const unexpected: string[] = [];
    for (const file of tscnFiles(fixturesDir)) {
      if (!file.startsWith('unit-')) continue;
      const allowed = new Set(UNIT_FIXTURE_WARNINGS[file]?.rules ?? []);
      unexpected.push(
        ...warningRulesFor(fixturesDir, file)
          .filter((rule) => !allowed.has(rule))
          .map((rule) => `${file}: ${rule}`)
      );
    }
    expect(unexpected).toEqual([]);
  });

  it('keeps the allowlist honest: every listed rule still fires', () => {
    // Set equality both ways. An entry that stopped firing means the fixture was
    // fixed or the rule changed, and the exemption is now a lie about the file.
    const stale: string[] = [];
    for (const [file, { rules }] of Object.entries(UNIT_FIXTURE_WARNINGS)) {
      const firing = new Set(warningRulesFor(fixturesDir, file));
      for (const rule of rules) {
        if (!firing.has(rule)) stale.push(`${file}: ${rule} is allowlisted but no longer fires`);
      }
    }
    expect(stale).toEqual([]);
  });

  it('every positive fixture produces zero error diagnostics', () => {
    const failures: string[] = [];
    for (const file of tscnFiles(fixturesDir)) {
      if (INTEGRATION_FIXTURES_WITH_ERRORS.has(file)) continue;
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
    for (const file of INTEGRATION_FIXTURES_WITH_ERRORS) {
      if (lintFile(fixturesDir, file).errors === 0) {
        silent.push(file);
      }
    }
    expect(silent).toEqual([]);
  });

  it('INTEGRATION_FIXTURES_WITH_ERRORS only lists files that exist', () => {
    const existing = new Set(tscnFiles(fixturesDir));
    const stale = [...INTEGRATION_FIXTURES_WITH_ERRORS].filter((f) => !existing.has(f));
    expect(stale).toEqual([]);
  });
});
