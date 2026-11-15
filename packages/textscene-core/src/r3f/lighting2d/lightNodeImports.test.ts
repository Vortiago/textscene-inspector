/**
 * A light node declares its term through `CanvasLight2D` and builds none of the pass's parts: only
 * files under `r3f/lighting2d/` register a light, mount a pass mesh or build a light quad material.
 * The scan covers every source file outside that folder.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const lightingDir = resolve(src, 'r3f/lighting2d');

const PASS_PARTS = [
  'usePassMeshRef',
  'useRegisterCanvasLight2D',
  'useApartLightOrigin',
  'createLightQuadMaterial',
  'createDirectionalLightMaterial',
];

/** Every non-test source file under `dir`, as a path relative to `src/`. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
    .map((entry) => resolve(entry.parentPath, entry.name).slice(src.length + 1))
    .sort();
}

/** Each `import … from` clause with its specifier. The clause spans lines in a braced list. */
function importsOf(file: string): { clause: string; specifier: string }[] {
  const source = readFileSync(resolve(src, file), 'utf8');
  return [...source.matchAll(/(?:^|\n)\s*import\b([^;]*?)from\s*['"]([^'"]+)['"]/g)].map((match) => ({
    clause: match[1] ?? '',
    specifier: match[2] ?? '',
  }));
}

describe('a light node imports the light pass through CanvasLight2D alone', () => {
  const files = sourceFiles(src);
  const outsideLighting = files.filter((file) => !resolve(src, file).startsWith(lightingDir + '/'));

  it('finds the light nodes, so the scan cannot pass vacuously', () => {
    expect(files).toContain('nodes/2d/pointlight2d/Component.tsx');
    expect(files).toContain('nodes/2d/directionallight2d/Component.tsx');
  });

  it.each(PASS_PARTS)('imports %s in no file outside r3f/lighting2d/', (part) => {
    const importers = outsideLighting.filter((file) =>
      importsOf(file).some(({ clause }) => new RegExp(`\\b${part}\\b`).test(clause))
    );
    expect(importers).toEqual([]);
  });

  it.each(['nodes/2d/pointlight2d/Component.tsx', 'nodes/2d/directionallight2d/Component.tsx'])(
    'imports one module of r3f/lighting2d/ in %s',
    (file) => {
      const lighting = importsOf(file)
        .map(({ specifier }) => specifier)
        .filter((specifier) => specifier.includes('/r3f/lighting2d/'));
      expect(lighting).toEqual(['../../../r3f/lighting2d/CanvasLight2D']);
    }
  );

  it('keeps the light quad materials out of nodes/', () => {
    expect(files).not.toContain('nodes/2d/pointlight2d/useLightQuadMaterials.ts');
  });
});
