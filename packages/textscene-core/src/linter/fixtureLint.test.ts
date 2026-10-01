/**
 * Lint guard over `scenes/fixtures` and every folder under it. A positive fixture produces no error. A negative
 * `edge-*` fixture in INTEGRATION_FIXTURES_WITH_ERRORS produces at least one, so its rule still fires. A fixture under
 * a `project.godot` is linted with that project's files. The caller chooses other directories (`pnpm lint:scenes`).
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Linter } from './Linter.js';
import { isGodotTextResourcePath } from '../godot/index.js';
import { parseHeading } from '../parser/utils.js';
import { findProjectRoot, parentDir, projectFileIn, resolveResPath } from '../resources/resPath.js';
import { resourceContent } from '../resources/resourceProviderUtils.js';
import { listScannedFiles, type DirectoryEntry } from '../resources/projectListing.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { FILE_DIAGNOSTIC_NAMES } from './fileDiagnostics.js';
import type { Diagnostic } from './types.js';
import './index.js';

const here = dirname(fileURLToPath(import.meta.url)); // .../packages/textscene-core/src/linter
const scenesRoot = resolve(here, '../../../../scenes');

/**
 * `unit-*` fixtures allowed an advisory (warning or info), keyed by the exact rules they may trip and asserted as set
 * equality. A unit fixture shows one node configured correctly, so an advisory usually means the fixture is wrong.
 * Keyed by rule, not filename, so the exemption does not blind a fixture to every later rule. Add an entry only when
 * the advisory is the fixture's point: fixing the fixture is the default.
 */
const UNIT_FIXTURE_ADVISORIES: Readonly<Record<string, { rules: readonly string[]; reason: string }>> = {
  'unit-legacy-format.tscn': {
    rules: ['legacy-format-version'],
    reason:
      'a Godot 3 file; the single advisory IS the fixture, and the errors its pre-4.0 spellings would otherwise draw are what the suppression exists to withhold',
  },
  'unit-unsupported-nodes.tscn': {
    rules: ['collisionobject3d-needs-collision-shape'],
    reason: 'exists to show unsupported types; the Area3D has no shape on purpose',
  },
  'unit-cpuparticles2d-unpreviewable.tscn': {
    rules: ['cpuparticles2d-nondeterministic-emission-shape', 'cpuparticles2d-fract-delta-ignored'],
    reason: 'named for the two advisories it carries; they are the fixture',
  },
  'unit-label-autowrap-in-container.tscn': {
    rules: ['label-autowrap-needs-custom-minimum-size'],
    reason:
      'the fixture IS that shape: an autowrapped Label sized by its container with no custom_minimum_size, held so the height it reports can be measured against Godot',
  },
  'unit-instance-child.tscn': {
    rules: ['collisionobject3d-needs-collision-shape'],
    reason:
      "the Area3D root is a coin pickup whose shape comes from the scene that instances it; the fixture is about the instanced child's transform",
  },
  'unit-csg-combiner.tscn': {
    rules: ['collisionobject3d-needs-collision-shape'],
    reason:
      'the StaticBody3D holds CSG geometry rather than a CollisionShape3D; the fixture is about CSG boolean output, not collision',
  },
  'unit-csg-mesh.tscn': {
    rules: ['csgmesh3d-requires-mesh'],
    reason:
      'the NoMesh node is deliberately meshless, to pin that Godot renders nothing rather than crashing or showing a placeholder',
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
  'unit-graph-edit.tscn': {
    rules: ['graphedit-scroll-offset-discarded'],
    reason:
      "exercises every ADD_PROPERTY GraphEdit binds, scroll_offset included, and in the saver's key order scroll_offset precedes zoom, so the load clamps it against an inverted range no authored value survives",
  },
  'unit-graph-edit-scroll-offset-clamped.tscn': {
    rules: ['graphedit-scroll-offset-discarded'],
    reason:
      'named for it: the fixture exists to move scroll_offset onto the clamp branch the advisory reports',
  },
  'unit-tile-map.tscn': {
    rules: ['tilemap-deprecated'],
    reason:
      'TileMap itself is unconditionally deprecated (tile_map.cpp:843); the fixture demonstrates the legacy type, not a defect',
  },
};

/**
 * Fixtures that must produce an error, from the one file that lists them: files Godot refuses to load, which the
 * app-shell and extension suites open as a user would (`docs/user-flows.md` WEB-10 walks through the parse-error banner).
 * `lint-staged.config.mjs` reads the same JSON to skip them in the pre-commit hook, so "must error" and "do not lint"
 * agree. A linter red test does not belong here: assert the validator or the rule directly.
 */
const INTEGRATION_FIXTURES_WITH_ERRORS: ReadonlySet<string> = new Set(
  (
    JSON.parse(readFileSync(join(scenesRoot, 'fixtures', 'negative-fixtures.json'), 'utf8')) as {
      files: string[];
    }
  ).files
);

/** How many fixtures that list is meant to hold; see the pin at the bottom. */
const NEGATIVE_FIXTURE_COUNT = 5;

const fixturesDir = join(scenesRoot, 'fixtures');

/**
 * Both text formats Godot writes, through the predicate the CLI walk and the editor's document filter use: a `.tres`
 * validates against the same registry a `[sub_resource]` block does, so the resource slices' fixtures are gated too.
 * Every folder under `dir`, as the CLI expands a directory argument.
 */
function tscnFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter(isGodotTextResourcePath)
    .map((file) => join(dir, file))
    .sort();
}

/**
 * The project a fixture's `res://` paths resolve in: the nearest `project.godot` from its folder up to
 * `scenes/fixtures`, or null for the flat corpus, which is no project.
 */
function projectRootOf(path: string): Promise<string | null> {
  const isFixturesDir = (dir: string) => resolve(dir) === fixturesDir;
  return findProjectRoot(dirname(path), parentDir, isFixturesDir, async (dir) =>
    existsSync(projectFileIn(dir))
  );
}

/** The entries of the directory a `res://` path names under `root`, as the CLI's walk reads them. */
function readDirectoryUnder(root: string, resDirectory: string): DirectoryEntry[] {
  const directory = resolveResPath(root, resDirectory);
  if (directory === null || !existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).map((entry) => ({
    name: entry.name,
    isDirectory: entry.isDirectory(),
  }));
}

/**
 * A provider over the project at `root`, as the CLI's provider reads it from disk: text or bytes by the type, and a
 * listing walked as the editor's scan walks it.
 */
function projectProvider(root: string): ResourceProvider {
  return {
    loadResource: async (resPath, type = '') => {
      const file = resolveResPath(root, resPath);
      if (file === null || !existsSync(file)) return null;
      return resourceContent(readFileSync(file), type, resPath);
    },
    listFiles: (extension) =>
      listScannedFiles(async (directory) => readDirectoryUnder(root, directory), extension),
  };
}

/** One fixture: where it lies, its name relative to `scenes/fixtures`, and the project it is linted in. */
interface Fixture {
  readonly path: string;
  readonly name: string;
  readonly provider: ResourceProvider | null;
}

async function fixture(path: string): Promise<Fixture> {
  const root = await projectRootOf(path);
  return { path, name: relative(fixturesDir, path), provider: root === null ? null : projectProvider(root) };
}

function lintFixture({ path, provider }: Fixture): Promise<Diagnostic[]> {
  return new Linter().lintComplete(readFileSync(path, 'utf8'), provider);
}

/** Diagnostics for every fixture, keyed by its name. Written once, in `beforeAll`, before the checks read them. */
let diagnosticsByName = new Map<string, Diagnostic[]>();

/** A name no fixture has reads as clean, so a stale allowlist entry reports as one that no longer fires. */
function diagnosticsFor(name: string): Diagnostic[] {
  return diagnosticsByName.get(name) ?? [];
}

function lintFile(name: string): { errors: number; messages: string[] } {
  const errors = diagnosticsFor(name).filter((d) => d.severity === 'error');
  return { errors: errors.length, messages: errors.map((e) => `${name}: ${e.message}`) };
}

/** Distinct advisory (warning or info) rule names one file trips. */
function advisoryRulesFor(name: string): string[] {
  return [
    ...new Set(
      diagnosticsFor(name)
        .filter((d) => d.severity !== 'error')
        .map((d) => d.ruleName)
    ),
  ];
}

describe('shipped scenes lint clean (bulk fixture guard)', () => {
  let all: Fixture[] = [];

  beforeAll(async () => {
    all = await Promise.all(tscnFiles(fixturesDir).map(fixture));
    diagnosticsByName = new Map(
      await Promise.all(all.map(async (linted) => [linted.name, await lintFixture(linted)] as const))
    );
  });

  it('finds the fixtures directory and its sub-projects (path layout guard)', () => {
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((linted) => linted.provider !== null)).toBe(true);
  });

  it('every unit-* fixture reports an advisory only where allowlisted, rule by rule', () => {
    const unexpected: string[] = [];
    for (const { name } of all) {
      if (!basename(name).startsWith('unit-')) continue;
      const allowed = new Set(UNIT_FIXTURE_ADVISORIES[name]?.rules ?? []);
      unexpected.push(
        ...advisoryRulesFor(name)
          .filter((rule) => !allowed.has(rule))
          .map((rule) => `${name}: ${rule}`)
      );
    }
    expect(unexpected).toEqual([]);
  });

  it('keeps the allowlist honest: every listed rule still fires', () => {
    // Set equality both ways. An entry that stopped firing means the fixture was
    // fixed or the rule changed, and the exemption is now a lie about the file.
    const stale: string[] = [];
    for (const [file, { rules }] of Object.entries(UNIT_FIXTURE_ADVISORIES)) {
      const firing = new Set(advisoryRulesFor(file));
      for (const rule of rules) {
        if (!firing.has(rule)) stale.push(`${file}: ${rule} is allowlisted but no longer fires`);
      }
    }
    expect(stale).toEqual([]);
  });

  it('every positive fixture produces zero error diagnostics', () => {
    const failures: string[] = [];
    for (const { name } of all) {
      if (INTEGRATION_FIXTURES_WITH_ERRORS.has(basename(name))) continue;
      failures.push(...lintFile(name).messages);
    }
    expect(failures).toEqual([]);
  });

  it('keeps the negative list honest: every entry exists and still errors', () => {
    // Take an entry away and the check above must fail. A listed fixture that
    // was deleted, or that someone fixed, exempts nothing and has silently
    // stopped being a negative test. Existence is checked first, so a deleted
    // entry reports as stale rather than as an ENOENT out of the linter.
    const byBasename = new Map(all.map(({ name }) => [basename(name), name]));
    const stale: string[] = [];
    for (const file of INTEGRATION_FIXTURES_WITH_ERRORS) {
      const name = byBasename.get(file);
      if (name === undefined) {
        stale.push(`${file}: listed but no longer in scenes/fixtures`);
      } else if (lintFile(name).errors === 0) {
        stale.push(`${file}: listed as a negative fixture but produces no error`);
      }
    }
    expect(stale).toEqual([]);
  });

  it('puts every diagnostic on a line, and a rule diagnostic on the heading of the node it names', () => {
    // A host marks a line only where a diagnostic names one, so a finding with none
    // is shown as one about the whole file. No finding here is about the whole file.
    const misplaced: string[] = [];
    let checkedRuleDiagnostics = 0;
    for (const { path, name: file } of all) {
      const text = readFileSync(path, 'utf8').split(/\r?\n/);
      for (const d of diagnosticsFor(file)) {
        const line = d.location?.line;
        if (line === undefined) {
          misplaced.push(`${file}: ${d.ruleName} carries no line`);
          continue;
        }
        if (FILE_DIAGNOSTIC_NAMES.has(d.ruleName)) continue;
        checkedRuleDiagnostics++;
        const heading = parseHeading(text[line - 1] ?? '');
        if (heading?.type !== 'node' || (heading.attributes.name ?? '') !== d.nodeName) {
          misplaced.push(`${file}:${line}: ${d.ruleName} names '${d.nodeName}', and this is not its heading`);
        }
      }
    }
    expect(misplaced).toEqual([]);
    expect(checkedRuleDiagnostics).toBeGreaterThan(0);
  });

  it('pins how many negative fixtures there are, so the list cannot empty itself', () => {
    // Exact equality, not a floor: retiring a fixture and its entry together
    // leaves every check above green, so the count is the only thing that can
    // notice, and it must be touched deliberately in either direction.
    expect(INTEGRATION_FIXTURES_WITH_ERRORS.size).toBe(NEGATIVE_FIXTURE_COUNT);
  });
});
