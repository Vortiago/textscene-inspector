/**
 * Guard: slice registrations stay renderer-free, and Godot-resource parsing
 * stays inside the loading layer (ADR-0031).
 *
 *  1. Every slice `index.ts` is a THREE-free, React-free closure — a claim
 *     table a linter entry point can read without pulling a renderer in
 *     (the `buildableMaterialTypes` precedent, enforced repo-wide).
 *  2. `parseTresFile` is VALUE-imported only by the loading layer (the tres
 *     processor and the two slices whose decode consumes whole-file content);
 *     `import type { ParsedResource }` stays legal everywhere.
 *  3. Nobody value-shape-sniffs a property bag (`startsWith('Color(')` …) —
 *     the pattern the campaign retired; survivors are enumerated so the list
 *     can only shrink.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bareSpecifiers, tsxFiles, walkImportClosure } from '@textscene/dev-kit';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/resources
const srcRoot = resolve(here, '..');

const REGISTER_RE = /\bregister(ResourceSlice|ShapeSlice|MeshSlice)\s*\(/;

function findRegisteringIndexes(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findRegisteringIndexes(full));
    else if (entry.name === 'index.ts' && REGISTER_RE.test(readFileSync(full, 'utf8'))) {
      out.push(full);
    }
  }
  return out;
}

function allSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...allSourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('slice index closures are renderer-free', () => {
  it('no slice index.ts value-imports three or react, or reaches a .tsx', () => {
    const indexes = findRegisteringIndexes(here);
    expect(indexes.length).toBeGreaterThanOrEqual(30); // not vacuous
    const failures: string[] = [];
    for (const index of indexes) {
      const closure = walkImportClosure(index);
      expect(closure.unresolved).toEqual([]); // the walker must not go blind
      const bare = bareSpecifiers(closure).filter((s) => /^(three|react)($|\/)/.test(s));
      if (bare.length) failures.push(`${relative(srcRoot, index)}: ${bare.join(', ')}`);
      const tsx = tsxFiles(closure);
      if (tsx.length) failures.push(`${relative(srcRoot, index)}: reaches ${tsx[0]}`);
    }
    expect(failures).toEqual([]);
  });
});

describe('Godot-resource parsing stays in the loading layer', () => {
  // Value-imports of the ParsedResource module. `import type` is erased and
  // legal everywhere; a VALUE import means "I parse file content myself".
  const PARSE_ALLOWED = new Set([
    'parser/parsedResource.test.ts',
    'resources/processors/createTresResourceProcessor.ts',
    // The two slices whose decode consumes whole-file content by design:
    // materials orchestrate sub-resource addressing, ArrayMesh reads the
    // byte-payload dictionaries.
    'resources/materials/standardmaterial3d/loadMaterial.ts',
    'resources/meshes/arraymesh/decode.ts',
  ]);
  const VALUE_IMPORT_RE =
    /import\s+(?!type\b)[^;]*?from\s+'[^']*parsedResource(?:\.js)?'|import\(\s*'[^']*parsedResource(?:\.js)?'\s*\)/;

  it('parseTresFile is value-imported only by the allowlist', () => {
    const offenders: string[] = [];
    for (const file of allSourceFiles(srcRoot)) {
      const rel = relative(srcRoot, file);
      if (rel === 'parser/parsedResource.ts') continue; // the definition
      const source = readFileSync(file, 'utf8');
      if (VALUE_IMPORT_RE.test(source) && !PARSE_ALLOWED.has(rel)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it('the allowlisted call sites still exist — the scan is not vacuous', () => {
    const live = [...PARSE_ALLOWED].filter(
      (rel) => !rel.endsWith('.test.ts') && VALUE_IMPORT_RE.test(readFileSync(join(srcRoot, rel), 'utf8'))
    );
    expect(live.length).toBeGreaterThanOrEqual(3);
  });

  const SNIFF_RE = /\.startsWith\(\s*['"](?:Color|Vector[23]i?|Rect2)\(/;
  // bbcode's `[color=Color(…)]` tag VALUE check is bbcode grammar, not a
  // resource property bag — the one legitimate survivor.
  const SNIFF_ALLOWED = new Set(['nodes/2d/ui/richtextlabel/bbcode.tsx']);

  it('nobody value-shape-sniffs a property bag', () => {
    const offenders: string[] = [];
    for (const file of allSourceFiles(srcRoot)) {
      const rel = relative(srcRoot, file);
      if (SNIFF_RE.test(readFileSync(file, 'utf8')) && !SNIFF_ALLOWED.has(rel)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it('the sniffing survivor is still there — the scan is not vacuous', () => {
    expect(SNIFF_RE.test(readFileSync(join(srcRoot, 'nodes/2d/ui/richtextlabel/bbcode.tsx'), 'utf8'))).toBe(
      true
    );
  });
});
