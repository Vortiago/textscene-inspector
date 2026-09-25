/**
 * Guard: every slice with lint code is wired into the linter barrel. It walks `src/nodes/**` for `index.linter.ts` and
 * `src/resources/**` for each slice's entry point, and asserts `linter/index.ts` imports each one: rooted at nodes/
 * alone, a lost resource import would take every Environment validator with it. Every relative import in the barrel
 * must also resolve to a file on disk. A slice with no `index.linter.ts` has no lint code to wire.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/linter
const srcRoot = resolve(here, '..'); // .../src
const nodesRoot = resolve(srcRoot, 'nodes');
const resourcesRoot = resolve(srcRoot, 'resources');
const barrelPath = resolve(here, 'index.ts');

/**
 * Barrel specifiers (for example `'../nodes/2d/ui/control/index.linter.js'`) whose lint entry point stays out of the
 * barrel on purpose. Empty: every slice's lint entry ships in the linter bundle. Add one, with a reason, only when it must not.
 */
const ALLOWLIST: string[] = [];

function findLinterEntryPoints(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findLinterEntryPoints(full));
    else if (entry.name === 'index.linter.ts') out.push(full);
  }
  return out;
}

/**
 * A resource slice's lint entry point: its `index.linter.ts` when it has one,
 * else its `linterValidators.ts`. Both exist under `resources/environment/`,
 * where the index is the entry point and imports the validators itself, so
 * requiring both would demand an import the barrel deliberately does not make.
 */
function findResourceEntryPoints(dir: string): string[] {
  const out: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const names = new Set(entries.filter((e) => e.isFile()).map((e) => e.name));
  const own = names.has('index.linter.ts')
    ? 'index.linter.ts'
    : names.has('linterValidators.ts')
      ? 'linterValidators.ts'
      : null;
  if (own) out.push(join(dir, own));
  for (const entry of entries) {
    if (entry.isDirectory()) out.push(...findResourceEntryPoints(join(dir, entry.name)));
  }
  return out;
}

/** Every barrel specifier a lint entry point on disk must be imported as. */
function requiredSpecifiers(): string[] {
  return [...findLinterEntryPoints(nodesRoot), ...findResourceEntryPoints(resourcesRoot)].map(
    expectedSpecifier
  );
}

/** All relative specifiers in the barrel (side-effect imports and export…from). */
function barrelRelativeSpecifiers(): string[] {
  const src = readFileSync(barrelPath, 'utf8');
  const re = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^;'"]*?\sfrom\s*)?['"]([^'"]+)['"]/g;
  const specs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m[1]!.startsWith('.')) specs.push(m[1]!);
  }
  return specs;
}

/** Resolve a relative `.js` (NodeNext) specifier to an on-disk source file. */
function resolveSpecifier(spec: string): string | null {
  const base = resolve(here, spec);
  const candidates: string[] = [];
  if (base.endsWith('.js')) {
    const stem = base.slice(0, -3);
    candidates.push(stem + '.ts', stem + '.tsx');
  } else if (extname(base)) {
    candidates.push(base);
  } else {
    candidates.push(base + '.ts', base + '.tsx', resolve(base, 'index.ts'));
  }
  return candidates.find((c) => existsSync(c)) ?? null;
}

/** The barrel specifier a slice's index.linter.ts must be imported as. */
function expectedSpecifier(entryPoint: string): string {
  const rel = relative(srcRoot, entryPoint).split('\\').join('/');
  return `../${rel.replace(/\.ts$/, '.js')}`;
}

describe('linter barrel completeness', () => {
  it('finds the slice lint entry points (sanity: the walk is not empty)', () => {
    // Near the real counts, not at 1: `missing` below is computed over this
    // population, so a walk that respells or relocates the entry point and
    // matches a handful reports [] over the slices it stopped seeing. 242
    // under nodes/ and 12 under resources/ today.
    expect(findLinterEntryPoints(nodesRoot).length).toBeGreaterThan(200);
    expect(requiredSpecifiers().length).toBeGreaterThan(200);
  });

  it('covers the Resource half of the barrel, not just nodes/', () => {
    // The barrel registers resource validators too; a walk rooted only at
    // nodes/ lets an import be deleted with every suite still green.
    const required = requiredSpecifiers();
    expect(required).toContain('../resources/resource/linterValidators.js');
    expect(required).toContain('../resources/environment/index.linter.js');
    // environment's index pulls its own linterValidators, so the barrel does
    // not import that file and must not be asked to.
    expect(required).not.toContain('../resources/environment/linterValidators.js');
  });

  it('linter/index.ts imports every lint entry point (minus the allowlist)', () => {
    const imported = new Set(barrelRelativeSpecifiers());
    const missing = requiredSpecifiers().filter(
      (spec) => !imported.has(spec) && !ALLOWLIST.includes(spec)
    );
    expect(missing).toEqual([]);
  });

  it('every relative import in linter/index.ts resolves to an existing file', () => {
    const stale = barrelRelativeSpecifiers().filter((spec) => resolveSpecifier(spec) === null);
    expect(stale).toEqual([]);
  });

  it('the allowlist itself stays honest (no entries that are imported anyway or gone)', () => {
    const imported = new Set(barrelRelativeSpecifiers());
    for (const spec of ALLOWLIST) {
      expect(imported.has(spec)).toBe(false); // imported → drop from allowlist
      expect(resolveSpecifier(spec)).not.toBeNull(); // deleted → drop from allowlist
    }
  });
});
