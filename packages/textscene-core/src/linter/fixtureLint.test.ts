/**
 * Bulk lint guard over `scenes/fixtures`, this package's OWN test corpus.
 *
 * Positive fixtures must produce zero error-severity diagnostics (warnings are
 * allowed — some scenes intentionally carry advisory warnings). Negative
 * `edge-*` fixtures listed in INTEGRATION_FIXTURES_WITH_ERRORS must produce at
 * least one error, pinning that the rules they exist to trigger actually
 * fire — the gap class where a rule exists but its fixture silently stops
 * exercising it.
 *
 * Scope is deliberately ONE directory, and it is the one `fixtureCheck.ts`
 * already reads: these files back this package's unit tests, so the coupling
 * is to its own data rather than to the repository's layout. Which OTHER
 * directories get swept is the caller's decision, made where the linter is
 * invoked (`pnpm lint:scenes`, and the CI step beside it), not encoded here.
 * Sweeping two directories from inside the library is what kept
 * `scenes/demos` — 220 vendored Godot scenes — out of every gate, and two
 * false positives shipped behind that gap.
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
  'unit-legacy-format.tscn': {
    rules: ['legacy-format-version'],
    reason:
      'a Godot 3 file; the single warning IS the fixture, and the errors its pre-4.0 spellings would otherwise draw are what the suppression exists to withhold',
  },
  'unit-unsupported-nodes.tscn': {
    rules: ['area3d-needs-collision-shape'],
    reason: 'exists to show unsupported types; the Area3D has no shape on purpose',
  },
  'unit-cpuparticles2d-unpreviewable.tscn': {
    rules: [
      'cpuparticles2d-nondeterministic-emission-shape',
      'cpuparticles2d-fract-delta-ignored',
    ],
    reason: 'named for the two advisories it carries; they are the fixture',
  },
  'unit-instance-child.tscn': {
    rules: ['area3d-needs-collision-shape'],
    reason: "the Area3D root is a coin pickup whose shape comes from the scene that instances it; the fixture is about the instanced child's transform",
  },
  'unit-csg-combiner.tscn': {
    rules: ['staticbody3d-needs-collision-shape'],
    reason: 'the StaticBody3D holds CSG geometry rather than a CollisionShape3D; the fixture is about CSG boolean output, not collision',
  },
  'unit-csg-mesh.tscn': {
    rules: ['csgmesh3d-requires-mesh'],
    reason: 'the NoMesh node is deliberately meshless, to pin that Godot renders nothing rather than crashing or showing a placeholder',
  },
  'unit-animation-tree-stateless.tscn': {
    rules: ['animationtree-inactive'],
    reason: 'named for it: the tree is inactive on purpose, which is the advisory',
  },
  'unit-container.tscn': {
    rules: ['container-no-script'],
    reason:
      'demonstrates the bare Container type itself — no script attached is exactly what container.cpp:210-211 warns about, and this fixture exists to show that a plain, unscripted Container renders as nothing',
  },
  'unit-tile-map.tscn': {
    rules: ['tilemap-deprecated'],
    reason: 'TileMap itself is unconditionally deprecated (tile_map.cpp:843); the fixture demonstrates the legacy type, not a defect',
  },
};

/**
 * Fixtures that must produce >=1 error, read from the one file that lists them.
 *
 * Each is an app-shell or extension INTEGRATION fixture: a selectable, really
 * broken file the VS Code integration suite opens, and that
 * `docs/user-guide-web.md` walks a user through to demonstrate the parse-error
 * banner and the recovery from it. A unit test cannot stand in for them,
 * because the thing under test is the host reacting to a file a user picked.
 *
 * `lint-staged.config.mjs` reads the same JSON to skip them in the pre-commit
 * hook, which would otherwise fail on every commit touching one. Sharing the
 * list is what keeps "must error" and "do not lint" from disagreeing.
 *
 * A linter red test does NOT belong here: assert the validator or the rule
 * directly, which is faster and localises the failure.
 */
const INTEGRATION_FIXTURES_WITH_ERRORS: ReadonlySet<string> = new Set(
  (
    JSON.parse(
      readFileSync(join(scenesRoot, 'fixtures', 'negative-fixtures.json'), 'utf8')
    ) as { files: string[] }
  ).files
);

/** How many fixtures that list is meant to hold; see the pin at the bottom. */
const NEGATIVE_FIXTURE_COUNT = 3;

/**
 * Both text formats Godot writes. A `.tres` carries its type in the
 * `[gd_resource]` header rather than a section heading, and validates against
 * the same registry a `[sub_resource]` block does — so leaving it out of this
 * sweep left the resource slices' own fixtures ungated.
 */
function tscnFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.tscn') || f.endsWith('.tres'))
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

  it('finds the fixtures directory (path layout guard)', () => {
    expect(tscnFiles(fixturesDir).length).toBeGreaterThan(0);
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

  it('keeps the negative list honest: every entry exists and still errors', () => {
    // Take an entry away and the sweep above must fail. A listed fixture that
    // was deleted, or that someone fixed, exempts nothing and has silently
    // stopped being a negative test. Existence is checked first, so a deleted
    // entry reports as stale rather than as an ENOENT out of the linter.
    const existing = new Set(tscnFiles(fixturesDir));
    const stale: string[] = [];
    for (const file of INTEGRATION_FIXTURES_WITH_ERRORS) {
      if (!existing.has(file)) {
        stale.push(`${file}: listed but no longer in scenes/fixtures`);
      } else if (lintFile(fixturesDir, file).errors === 0) {
        stale.push(`${file}: listed as a negative fixture but produces no error`);
      }
    }
    expect(stale).toEqual([]);
  });

  it('pins how many negative fixtures there are, so the list cannot empty itself', () => {
    // Exact equality, not a floor: retiring a fixture and its entry together
    // leaves every check above green, so the count is the only thing that can
    // notice, and it must be touched deliberately in either direction.
    expect(INTEGRATION_FIXTURES_WITH_ERRORS.size).toBe(NEGATIVE_FIXTURE_COUNT);
  });
});
