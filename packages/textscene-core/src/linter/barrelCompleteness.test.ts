/**
 * Guard: every slice that has lint code is wired into the linter barrel.
 *
 * Walks the filesystem under `src/nodes/**` for `index.linter.ts` entry
 * points and asserts `linter/index.ts` imports each one — so "slice has lint
 * code but the barrel forgot it" turns red instead of silently shipping a
 * linter that skips the slice. The inverse is asserted too: every relative
 * import in the barrel resolves to a file on disk (no stale imports after a
 * slice moves or is deleted).
 *
 * Slices with NO `index.linter.ts` are out of scope by design — e.g. the
 * Control slices (`nodes/2d/ui/*`) are render-only 2D overlay types
 * (ADR-0003) with no validators or rules to register.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/linter
const srcRoot = resolve(here, '..'); // .../src
const nodesRoot = resolve(srcRoot, 'nodes');
const barrelPath = resolve(here, 'index.ts');

/**
 * Intentional exclusions: barrel specifiers (e.g.
 * `'../nodes/2d/ui/control/index.linter.js'`) for slices whose lint entry
 * point deliberately stays OUT of the barrel. Currently empty — Controls
 * have no index.linter.ts at all, so nothing needs excluding. Add an entry
 * here (with a reason) only when a slice gains lint code that must not ship
 * in the linter bundle.
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
    expect(findLinterEntryPoints(nodesRoot).length).toBeGreaterThan(0);
  });

  it('linter/index.ts imports every nodes/** index.linter.ts (minus the allowlist)', () => {
    const imported = new Set(barrelRelativeSpecifiers());
    const missing = findLinterEntryPoints(nodesRoot)
      .map(expectedSpecifier)
      .filter((spec) => !imported.has(spec) && !ALLOWLIST.includes(spec));
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
