/**
 * Every module that registers validators (a node slice's `linterParser.ts`, a resource slice's `linterValidators.ts`)
 * reaches its nearest validator-bearing ancestor in `CLASS_BASE_TYPES` through its own imports. Registration is a
 * module side effect, so an unimported ancestor leaves an inherited key resolving to null. `linter/index.ts` imports
 * every slice, but a scoped slice test loads only its own module graph.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
// The table the registry is constructed with: both hierarchies merged, catalog
// plus the uncatalogued entries. Walking the node half alone gives every
// resource type a null chain, and the check passes over them vacuously.
import { CLASS_BASE_TYPES } from '../godot/classBaseTypes.js';
import { allSourceFiles, srcRoot, walk } from './testing/ruleNameScrape.js';

/** The two filenames a registration lives in, one per hierarchy. */
const REGISTRATION_FILENAMES = new Set(['linterParser.ts', 'linterValidators.ts']);

/** Every registration module under `src/`, at any depth. */
const findRegistrationModules = (): string[] =>
  walk(srcRoot, (name) => REGISTRATION_FILENAMES.has(name));

/** Every non-test source module, so the population can be checked complete. */
const findSourceModules = (): string[] => allSourceFiles();

const REGISTRATION_CALL = /\bvalidatorRegistry\.register(?:All|Unavailable)\(/;

/**
 * Every registration module a file imports, named and side-effect alike: a named import registers the module too
 * (`AimModifier3D` pulls `boneConstraintBaseLeaves` from its base). It returns every specifier, since importing a
 * sibling's parser does not register the file's own chain. The two names are enumerated: a wildcard would take in a
 * node slice's `linter.js` and a resource slice's `backgroundValidators.js`, which register nothing.
 */
const REGISTRATION_IMPORT =
  /^import\s+(?:[^;]*?\sfrom\s+)?'([^']*linter(?:Parser|Validators)\.js)';/gm;

function importedRegistrationModules(source: string): string[] {
  return [...source.matchAll(REGISTRATION_IMPORT)].map((m) => m[1]!);
}

/**
 * Type -> the file that owns its validators, tiers included. Both spellings count: a fixed-orientation container only
 * takes away its base's `vertical`, calling `registerUnavailable` and no `registerAll`. Without it, a descendant could
 * reach BoxContainer past VBoxContainer and read as clean while accepting the removed key.
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
 * Every registration module reachable from `file` by following imports, itself included. Transitive, because
 * registration is: `ColorPicker` imports VBoxContainer's parser, which imports BoxContainer's, so BoxContainer is
 * registered. Demanding a direct import of the nearest ancestor would call such a slice broken.
 */
function reachableRegistrationModules(file: string): Set<string> {
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
    for (const spec of importedRegistrationModules(source)) {
      queue.push(resolve(dirname(current), spec.replace(/\.js$/, '.ts')));
    }
  }
  return seen;
}

/**
 * The two hierarchy roots. Nothing sits above them, so they are the only names
 * `CLASS_BASE_TYPES` legitimately has no entry for.
 */
const HIERARCHY_ROOTS = new Set(['Node', 'Resource']);

/** The closest ancestor that registers validators, or null at the terminal. */
function nearestValidatorAncestor(type: string, owners: Map<string, string>): string | null {
  const seen = new Set<string>();
  let current: string | undefined = CLASS_BASE_TYPES[type];
  while (current && !seen.has(current)) {
    if (owners.has(current)) return current;
    seen.add(current);
    current = CLASS_BASE_TYPES[current];
  }
  return null;
}

describe('base-chain imports', () => {
  const files = findRegistrationModules();
  const owners = buildOwners(files);

  it('finds the slices, so the sweep cannot pass vacuously', () => {
    expect(files.length).toBeGreaterThan(150);
    expect(owners.size).toBeGreaterThan(150);
    // One terminal per hierarchy: both halves are in the population.
    expect(owners.has('Node')).toBe(true);
    expect(owners.has('Resource')).toBe(true);
  });

  it('holds every registering module, so a third filename cannot hide', () => {
    const population = new Set(files);
    const missed = findSourceModules()
      .filter((f) => REGISTRATION_CALL.test(readFileSync(f, 'utf8')) && !population.has(f))
      .map((f) => relative(srcRoot, f));
    expect(
      missed,
      `These modules register validators under a filename the sweep does not collect,\n` +
        `so their base chain is unchecked:\n  ${missed.join('\n  ')}`
    ).toEqual([]);
  });

  it('counts a slice whose whole contribution is a removal', () => {
    // A fixed-orientation container calls only `registerUnavailable`, so a
    // population scraped from `registerAll` alone never visits it, and a
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
    expect(importedRegistrationModules("import '../../base/node2d/linterParser.js';")).toEqual([
      '../../base/node2d/linterParser.js',
    ]);
    expect(importedRegistrationModules("import { LEAVES } from '../base/linterParser.js';")).toEqual(
      ['../base/linterParser.js']
    );
    expect(importedRegistrationModules("import '../material/linterValidators.js';")).toEqual([
      '../material/linterValidators.js',
    ]);
    expect(importedRegistrationModules("import { v } from '../validators/index.js';")).toEqual([]);
    // A resource slice's key modules end in `Validators.js` and register nothing;
    // collecting one would report a chain that does not exist.
    expect(importedRegistrationModules("import { bg } from './backgroundValidators.js';")).toEqual(
      []
    );
    // Several slices import two ancestors (a tier plus a spatial base); all must
    // be collected, or resolving against the computed one becomes a coin flip.
    expect(
      importedRegistrationModules(
        "import '../../base/node3d/linterParser.js';\nimport '../../base/node2d/linterParser.js';"
      )
    ).toHaveLength(2);
  });

  it('registers only names the base table knows', () => {
    // A name absent from `CLASS_BASE_TYPES` has no chain, so the check below would skip it as if clean. The
    // registry-side guard cannot close this: `registeredTypes('declaring')` excludes a type whose whole contribution
    // is a removal.
    const unknown = [...owners]
      .filter(([type]) => !HIERARCHY_ROOTS.has(type) && CLASS_BASE_TYPES[type] === undefined)
      .map(([type, file]) => `${type} (${relative(srcRoot, file)})`)
      .sort();
    expect(
      unknown,
      `These registered names are in no base table, so Godot has no such class and\n` +
        `their chain is never checked:\n  ${unknown.join('\n  ')}`
    ).toEqual([]);
  });

  it('every slice REACHES the ancestor the base chain names', () => {
    const wrong: string[] = [];
    for (const [type, file] of [...owners].sort()) {
      // Null at a hierarchy root, which has nothing above it. Every other name
      // resolves, held true by the check above.
      const ancestor = nearestValidatorAncestor(type, owners);
      if (!ancestor) continue;
      const wanted = owners.get(ancestor)!;
      if (!reachableRegistrationModules(file).has(wanted)) {
        const direct = importedRegistrationModules(readFileSync(file, 'utf8'));
        wrong.push(
          `${type} (${relative(srcRoot, file)}) imports [${direct.join(', ') || 'nothing'}] ` +
            `and reaches no ${ancestor} (${relative(srcRoot, wanted)}) from there`
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
