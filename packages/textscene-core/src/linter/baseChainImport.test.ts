/**
 * Every slice that registers validators must IMPORT its nearest
 * validator-bearing ancestor, so the base chain registers when that slice alone
 * is loaded.
 *
 * Registration is a module side effect. `findValidator` walks NODE_BASE_TYPES,
 * but an ancestor that was never imported has registered nothing for the walk to
 * find, so an inherited key resolves to null. Production never saw this —
 * `linter/index.ts` imports every slice — but a scoped test loads only its own
 * module graph, which is precisely where a slice test lives.
 *
 * The cost was invisible and real: 44 slices could not assert ANY inherited
 * behaviour, and every one of them looked like it could. `CollisionShape3D`
 * showed the shape — a test asserting `transform` resolves failed, not because
 * Node3D was wrong but because nothing had loaded it.
 *
 * The scaffold emits this import for new slices, and the `INHERITED` identity
 * table it now generates fails without it. This guard covers the ones written
 * before either existed, and stops a hand-written slice from reintroducing it.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// The MERGED table (catalog plus the uncatalogued entries), not the generated
// half: a type missing from ClassDB still has a chain here.
import { NODE_BASE_TYPES } from './nodeBaseTypes.js';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/linter
const nodesRoot = resolve(here, '../nodes');

/** Every `linterParser.ts` under `nodes/`, at any depth. */
function findLinterParsers(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findLinterParsers(full));
    else if (entry.name === 'linterParser.ts') out.push(full);
  }
  return out;
}

/**
 * EVERY `linterParser.js` a file imports, named and side-effect alike.
 *
 * A named import registers the module just as a bare one does — `AimModifier3D`
 * pulls `boneConstraintBaseLeaves` from its base and is thereby chained. Matching
 * only the side-effect form reported two such slices as broken when they were not.
 *
 * Returns every specifier rather than a boolean, because "imports SOMETHING"
 * is not the property under test. A slice importing a sibling's or a cousin's
 * parser satisfies that and still fails to register its own chain, which is the
 * very defect this file exists to catch.
 */
const LINTER_PARSER_IMPORT = /^import\s+(?:[^;]*?\sfrom\s+)?'([^']*linterParser\.js)';/gm;

function importedLinterParsers(source: string): string[] {
  return [...source.matchAll(LINTER_PARSER_IMPORT)].map((m) => m[1]!);
}

/**
 * Type -> the file that owns its validators, tiers included.
 *
 * Both spellings count. A slice whose whole relationship to its base is
 * SUBTRACTIVE — the six fixed-orientation containers, which only take away the
 * `vertical` their base exposes — calls `registerUnavailable` and no
 * `registerAll` at all. Scraping the one spelling dropped them from the
 * population AND from the ancestor set this sweep resolves against, so a
 * descendant could reach BoxContainer, skip VBoxContainer entirely, and read as
 * clean while quietly accepting the removed key.
 */
function buildOwners(files: string[]): Map<string, string> {
  const owners = new Map<string, string>();
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/register(?:All|Unavailable)\(\s*'([A-Za-z0-9_]+)'/g)) {
      owners.set(m[1]!, file);
    }
  }
  return owners;
}

/**
 * Every `linterParser.ts` reachable from `file` by following imports, itself
 * included.
 *
 * TRANSITIVE, because registration is: `ColorPicker` imports VBoxContainer's
 * parser, which imports BoxContainer's, and BoxContainer is thereby registered.
 * Demanding a DIRECT import of the nearest ancestor called nine slices broken
 * when seven were and two were not — and told the same story about both, which
 * is worse than either answer alone.
 */
function reachableLinterParsers(file: string): Set<string> {
  const seen = new Set<string>();
  const queue = [file];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    let source: string;
    try {
      source = readFileSync(current, 'utf8');
    } catch {
      continue; // a specifier that resolves nowhere is tsc's problem, not this guard's
    }
    for (const spec of importedLinterParsers(source)) {
      queue.push(resolve(dirname(current), spec.replace(/\.js$/, '.ts')));
    }
  }
  return seen;
}

/** The closest ancestor that registers validators, or null at the terminal. */
function nearestValidatorAncestor(type: string, owners: Map<string, string>): string | null {
  const seen = new Set<string>();
  let current: string | undefined = NODE_BASE_TYPES[type];
  while (current && !seen.has(current)) {
    if (owners.has(current)) return current;
    seen.add(current);
    current = NODE_BASE_TYPES[current];
  }
  return null;
}

describe('base-chain imports', () => {
  const files = findLinterParsers(nodesRoot);
  const owners = buildOwners(files);

  it('finds the slices, so the sweep cannot pass vacuously', () => {
    expect(files.length).toBeGreaterThan(150);
    expect(owners.size).toBeGreaterThan(150);
    expect(owners.has('Node')).toBe(true);
  });

  it('counts a slice whose whole contribution is a removal', () => {
    // A fixed-orientation container calls only `registerUnavailable`, so a
    // population scraped from `registerAll` alone never visits it — and a
    // descendant that reached BoxContainer while skipping VBoxContainer would
    // silently accept the `vertical` the removal exists to take away.
    expect([...owners.keys()]).toEqual(
      expect.arrayContaining([
        'HBoxContainer',
        'VBoxContainer',
        'HSplitContainer',
        'VSplitContainer',
        'HFlowContainer',
        'VFlowContainer',
      ])
    );
  });

  it('detects both import spellings, before trusting its own silence', () => {
    expect(importedLinterParsers("import '../../base/node2d/linterParser.js';")).toEqual([
      '../../base/node2d/linterParser.js',
    ]);
    expect(importedLinterParsers("import { LEAVES } from '../base/linterParser.js';")).toEqual([
      '../base/linterParser.js',
    ]);
    expect(importedLinterParsers("import { v } from '../validators/index.js';")).toEqual([]);
    // Several slices import two ancestors (a tier plus a spatial base); all must
    // be collected, or resolving against the computed one becomes a coin flip.
    expect(
      importedLinterParsers(
        "import '../../base/node3d/linterParser.js';\nimport '../../base/node2d/linterParser.js';"
      )
    ).toHaveLength(2);
  });

  it('every slice REACHES the ancestor the base chain names', () => {
    const wrong: string[] = [];
    for (const [type, file] of [...owners].sort()) {
      // `Node` is the terminal of every chain and has nothing above it.
      const ancestor = nearestValidatorAncestor(type, owners);
      if (!ancestor) continue;
      const wanted = owners.get(ancestor)!;
      if (!reachableLinterParsers(file).has(wanted)) {
        const direct = importedLinterParsers(readFileSync(file, 'utf8'));
        wrong.push(
          `${type} (${relative(nodesRoot, file)}) imports [${direct.join(', ') || 'nothing'}] ` +
            `and reaches no ${ancestor} (${relative(nodesRoot, wanted)}) from there`
        );
      }
    }
    expect(
      wrong,
      `These slices never reach the ancestor their base chain names, so an inherited\n` +
        `key resolves to null whenever the slice is loaded alone:\n  ${wrong.join('\n  ')}`
    ).toEqual([]);
  });
});
