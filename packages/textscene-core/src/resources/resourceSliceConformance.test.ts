/**
 * Guard: the Resource-slice contract (ADR-0031) holds for every slice, in the
 * barrelCompleteness / ruleCoverage idiom.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import './sliceRegistrations.js';
import { resourceSliceRegistry } from './sliceRegistration';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/resources
const barrelPath = resolve(here, 'sliceRegistrations.ts');

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

function barrelSpecifiers(): string[] {
  const source = readFileSync(barrelPath, 'utf8');
  return [...source.matchAll(/^import\s+'(\.\/[^']+)';/gm)].map((m) => m[1]!);
}

function specifierToDisk(spec: string): string {
  return resolve(here, spec.replace(/\.js$/, '.ts'));
}

// Barrel and disk: every registering `index.ts` under `src/resources/**` is
// imported by `sliceRegistrations.ts`, and every barrel specifier resolves.
describe('resource-slice barrel completeness', () => {
  const onDisk = findRegisteringIndexes(here).sort();
  const inBarrel = barrelSpecifiers().map(specifierToDisk).sort();

  it('finds slices at all — the walk is not vacuous', () => {
    expect(onDisk.length).toBeGreaterThanOrEqual(30);
  });

  it('imports every registering index.ts on disk', () => {
    const missing = onDisk.filter((p) => !inBarrel.includes(p));
    expect(missing).toEqual([]);
  });

  it('has no barrel specifier that resolves to nothing (stale after a move)', () => {
    const stale = inBarrel.filter((p) => !existsSync(p));
    expect(stale).toEqual([]);
  });
});

// Registry and disk: each registration has a slice folder with its kind's entry
// points. A `godot-text` slice has a pure `decode.ts` (`build.ts` only where THREE
// construction exists, so shapes and curves have none). A `foreign-format` slice
// declares its real parser instead of a hollow decode.
describe('resource-slice claim coverage', () => {
  const all = resourceSliceRegistry.all();
  const sliceDirs = new Map<string, string>();
  for (const index of findRegisteringIndexes(here)) sliceDirs.set(dirname(index), dirname(index));
  const dirByBasename = new Map<string, string>();
  for (const dir of sliceDirs.keys()) dirByBasename.set(dir.split('/').pop()!, dir);

  it('registered something — the barrel import is not vacuous', () => {
    expect(all.length).toBeGreaterThanOrEqual(30);
  });

  it('every registration has a slice folder, its kind-required entry points, and a registration test', () => {
    // A slice registered through a family helper (the shapes, the primitive
    // meshes) keeps its claims table in the helper's co-located test, one table
    // over the family. The helper's test is the registration test.
    const FAMILY_TESTS: Record<string, string> = {
      registerShapeSlice: join(here, 'shapes/shapes.test.ts'),
      registerMeshSlice: join(here, 'meshes/registerMeshSlice.test.ts'),
    };
    const failures: string[] = [];
    for (const reg of all) {
      const dir = dirByBasename.get(reg.slice);
      if (!dir) {
        failures.push(`${reg.slice}: no registering index.ts folder found`);
        continue;
      }
      // busType null means the loader never serves it and no ParsedResource
      // section reaches it (ViewportTexture decodes a NodePath), so a decode.ts
      // would have nothing to consume.
      if (reg.kind === 'godot-text' && reg.busType !== null && !existsSync(join(dir, 'decode.ts'))) {
        failures.push(`${reg.slice}: godot-text slice without decode.ts`);
      }
      if (reg.kind === 'foreign-format' && existsSync(join(dir, 'decode.ts'))) {
        failures.push(`${reg.slice}: foreign-format slice with a decode.ts (the hollow-file smell)`);
      }
      const indexSource = readFileSync(join(dir, 'index.ts'), 'utf8');
      const family = Object.entries(FAMILY_TESTS).find(([helper]) => indexSource.includes(helper));
      const hasTest = family
        ? existsSync(family[1])
        : existsSync(join(dir, 'registration.test.ts')) || existsSync(join(dir, 'index.test.ts'));
      if (!hasTest) failures.push(`${reg.slice}: no registration.test.ts / index.test.ts`);
    }
    expect(failures).toEqual([]);
  });

  it('no two slices claim one type name', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const reg of all) {
      for (const name of reg.typeNames) {
        const prior = seen.get(name);
        if (prior && prior !== reg.slice) dupes.push(`${name}: ${prior} vs ${reg.slice}`);
        seen.set(name, reg.slice);
      }
    }
    expect(dupes).toEqual([]);
  });

  it("never claims '.tres' as an extension — it is the shared Godot-text container", () => {
    const offenders = all.filter((r) => (r.extensions ?? []).includes('.tres'));
    expect(offenders.map((r) => r.slice)).toEqual([]);
  });

  it("each bus tag carries one failure label, and it is the loader's", () => {
    // The loader's per-bus labels (ResourceLoader.setupFailureCallbacks), as
    // literals so that map can move freely.
    const LOADER_LABELS: Record<string, string> = {
      texture: 'Material using texture',
      material: 'Node using material',
      scene: 'Node instance of scene',
      glb: 'Node using GLB mesh',
      resource: 'Resource',
      arraymesh: 'Node using ArrayMesh',
      font: 'Node using font',
      theme: 'Node using theme',
    };
    const failures: string[] = [];
    for (const reg of all) {
      if (reg.busType === null) continue; // not loader-served (ViewportTexture)
      const expected = LOADER_LABELS[reg.busType];
      if (reg.failureLabel !== expected) {
        failures.push(`${reg.slice}: label "${reg.failureLabel}" != loader's "${expected}"`);
      }
    }
    expect(failures).toEqual([]);
  });
});
