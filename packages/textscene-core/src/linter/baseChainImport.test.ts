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
 * ANY import of a `linterParser.js`, named or side-effect alike.
 *
 * A named import registers the module just as a bare one does — `AimModifier3D`
 * pulls `boneConstraintBaseLeaves` from its base and is thereby chained. Matching
 * only the side-effect form reported two such slices as broken when they were not.
 */
const IMPORTS_A_LINTER_PARSER = /^import\s+(?:[^;]*?\sfrom\s+)?'[^']*linterParser\.js';/m;

/** Type -> the file whose `registerAll` owns it, tiers included. */
function buildOwners(files: string[]): Map<string, string> {
  const owners = new Map<string, string>();
  for (const file of files) {
    for (const m of readFileSync(file, 'utf8').matchAll(/registerAll\(\s*'([A-Za-z0-9_]+)'/g)) {
      owners.set(m[1]!, file);
    }
  }
  return owners;
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

  it('detects both import spellings, before trusting its own silence', () => {
    expect(IMPORTS_A_LINTER_PARSER.test("import '../../base/node2d/linterParser.js';")).toBe(true);
    expect(
      IMPORTS_A_LINTER_PARSER.test("import { LEAVES } from '../base/linterParser.js';")
    ).toBe(true);
    expect(IMPORTS_A_LINTER_PARSER.test("import { v } from '../validators/index.js';")).toBe(false);
  });

  it('every slice with a validator-bearing ancestor imports one', () => {
    const missing: string[] = [];
    for (const [type, file] of [...owners].sort()) {
      // `Node` is the terminal of every chain and has nothing above it.
      const ancestor = nearestValidatorAncestor(type, owners);
      if (!ancestor) continue;
      if (!IMPORTS_A_LINTER_PARSER.test(readFileSync(file, 'utf8'))) {
        missing.push(`${type} (${relative(nodesRoot, file)}) should import ${ancestor}'s`);
      }
    }
    expect(
      missing,
      `These slices register validators but never import an ancestor, so an inherited\n` +
        `key resolves to null whenever the slice is loaded alone:\n  ${missing.join('\n  ')}`
    ).toEqual([]);
  });
});
