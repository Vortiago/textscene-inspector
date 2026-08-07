/**
 * `three-bvh-csg` must be imported from exactly one file, and only dynamically.
 *
 * A static import anywhere puts the CSG core plus `three-mesh-bvh` on the webview's
 * initial-paint path — tens of kB gzipped, paid by every scene for a feature most
 * scenes never touch. The budget guard would eventually catch that, but only after a
 * full extension build, and it would report a size rather than the mistake.
 *
 * Scanning the source says WHICH file broke the rule, immediately.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const SRC = resolve(import.meta.dirname, '../..');
const SOURCE_EXT = /\.(ts|tsx)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist']);

/**
 * Any form that actually pulls the package into a module graph. Deliberately NOT a bare
 * substring search: several files discuss three-bvh-csg in comments, and prose explaining
 * why the library behaves a certain way is exactly what should be encouraged.
 */
const IMPORTS_LIBRARY = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]three-bvh-csg['"]/;

/** The single production file allowed to import the package, plus the tests that may. */
const ALLOWED = new Set([
  'r3f/csg/csgModule.ts',
  // Statically imports the library on purpose: a test has no bundle to protect and
  // gains determinism from not going through the lazy loader.
  'r3f/csg/evaluateCsgPlan.test.ts',
  // This file matches its OWN pattern, because the pattern is written down in it.
  'r3f/csg/csgImportSite.contract.test.ts',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(entry)) out.push(full);
  }
  return out;
}

function mentioningFiles(pattern: RegExp): string[] {
  return walk(SRC)
    .filter((file) => pattern.test(readFileSync(file, 'utf8')))
    .map((file) => relative(SRC, file).split(sep).join('/'))
    .sort();
}

describe('three-bvh-csg import site', () => {
  it('is imported by only the allowlisted files', () => {
    const offenders = mentioningFiles(IMPORTS_LIBRARY).filter((f) => !ALLOWED.has(f));
    expect(offenders, `move the import into r3f/csg/csgModule.ts: ${offenders.join(', ')}`).toEqual([]);
  });

  it('finds the allowed sites at all, so the scan is not vacuous', () => {
    expect(mentioningFiles(IMPORTS_LIBRARY)).toContain('r3f/csg/csgModule.ts');
  });

  it('still allows prose about the library, which several modules rely on', () => {
    // The guard must not push authors into deleting the explanations of WHY the
    // library behaves as it does.
    const scanned = walk(SRC).map((f) => relative(SRC, f).split(sep).join('/'));
    expect(scanned).toContain('nodes/3d/csg/smoothNormals.ts');
    expect(readFileSync(join(SRC, 'nodes/3d/csg/smoothNormals.ts'), 'utf8')).toContain('three-bvh-csg');
  });

  it('imports it dynamically, never statically', () => {
    const source = readFileSync(join(SRC, 'r3f/csg/csgModule.ts'), 'utf8');
    expect(source).toMatch(/import\(\s*'three-bvh-csg'\s*\)/);
    // A bare `from 'three-bvh-csg'` would be hoisted onto the critical path.
    expect(source).not.toMatch(/^\s*import[^(]*from\s+'three-bvh-csg'/m);
  });

  it('keeps the library out of the parser and linter closures entirely', () => {
    // Those bundles must stay React- and THREE-free (ADR-0001); the CSG core is
    // strictly heavier than either.
    for (const entry of ['parser/TscnParser.ts', 'linter/index.ts']) {
      expect(readFileSync(join(SRC, entry), 'utf8')).not.toMatch(/three-bvh-csg/);
    }
  });
});
