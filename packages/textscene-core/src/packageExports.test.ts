/**
 * Each engine fact has one import route, and each package barrel serves only what a package outside
 * core imports. Core imports a fact from its file under a `godot/` group, so `godot/index.ts` and the
 * root `index.ts` re-export exactly the names the apps, the dev kit and the scripts import.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@textscene/dev-kit';
import { repoPath, walkSources } from './r3f/testing/sourceScan';

const coreSrc = dirname(fileURLToPath(import.meta.url));

const repoRoot = resolve(coreSrc, '../../..');
const godotDir = resolve(coreSrc, 'godot');

/** The specifier of an `… from '…'` clause or a dynamic `import('…')`. */
const SPECIFIER_RE = /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** A braced `export { … } from '…'` block of a barrel, `export type` included. */
const REEXPORT_RE = /\bexport\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g;

/** A braced `import { … } from 'specifier'`, its list spanning lines or not. */
function braceImportRe(specifier: string): RegExp {
  const quoted = specifier.replaceAll('/', '\\/');
  return new RegExp(String.raw`\bimport\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]${quoted}['"]`, 'g');
}

/** The names a braced list binds: `type X` reads as `X`, and `X as Y` as the exported `X`. */
function listedNames(list: string): string[] {
  return list
    .split(',')
    .map(
      (entry) =>
        entry
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0]!
    )
    .filter((name) => name !== '');
}

/** Whether `spec`, written in `file`, resolves to the godot barrel: `…/godot`, `…/godot/index` or `….js`. */
function namesGodotBarrel(file: string, spec: string): boolean {
  if (!spec.startsWith('.')) return false;
  const target = resolve(dirname(file), spec).replace(/\.js$/, '');
  return target === godotDir || target === resolve(godotDir, 'index');
}

function importsGodotBarrel(file: string, source: string): boolean {
  return [...stripComments(source).matchAll(SPECIFIER_RE)].some((match) =>
    namesGodotBarrel(file, (match[1] ?? match[2])!)
  );
}

/** The names `source`, its comments stripped, imports from exactly `specifier`. */
function namesImported(source: string, specifier: string): string[] {
  return [...source.matchAll(braceImportRe(specifier))].flatMap((match) => listedNames(match[1]!));
}

function barrelNames(barrel: string): string[] {
  const source = readFileSync(resolve(coreSrc, barrel), 'utf8');
  return [...stripComments(source).matchAll(REEXPORT_RE)].flatMap((match) => listedNames(match[1]!)).sort();
}

/**
 * The comment-stripped text of every source file outside core that may import it, tests included: a
 * test there goes through the package.
 */
const outsideCore = walkSources(
  ['apps', 'packages/textscene-dev-kit', 'scripts'].map((dir) => resolve(repoRoot, dir)),
  (name) => /\.(tsx?|m?js)$/.test(name)
).map(({ source }) => stripComments(source));

describe('core imports each engine fact from its own file', () => {
  it('recognises every spelling of a godot barrel import, before trusting its silence', () => {
    const file = resolve(coreSrc, 'nodes/x/y/parser.ts');
    expect(importsGodotBarrel(file, "import {\n  a,\n} from '../../../godot/index.js';")).toBe(true);
    expect(importsGodotBarrel(file, "import { a } from '../../../godot';")).toBe(true);
    expect(importsGodotBarrel(file, "const m = await import('../../../godot/index');")).toBe(true);
    expect(importsGodotBarrel(file, "import { a } from '../../../godot/math/math.js';")).toBe(false);
    expect(importsGodotBarrel(file, "// import { a } from '../../../godot';")).toBe(false);
  });

  it('lets no core file import through the godot barrel', () => {
    const sources = walkSources([coreSrc], (name) => /\.tsx?$/.test(name));
    expect(sources.length).toBeGreaterThan(100);
    const offenders = sources.filter(({ file, source }) => importsGodotBarrel(file, source));
    expect(
      offenders.map(({ file }) => repoPath(file)),
      'import the fact from its file under godot/<group>/'
    ).toEqual([]);
  });
});

describe('a package barrel re-exports only what a package outside core imports', () => {
  it('reads each name an import binds from exactly its specifier', () => {
    const source =
      "import {\n  type A,\n  b as c,\n} from '@textscene/core/godot';\nimport { d } from '@textscene/core';";
    expect(namesImported(source, '@textscene/core/godot')).toEqual(['A', 'b']);
    expect(namesImported(source, '@textscene/core')).toEqual(['d']);
  });

  it.each([
    ['godot/index.ts', '@textscene/core/godot'],
    ['index.ts', '@textscene/core'],
  ])('%s re-exports exactly the names imported through %s', (barrel, specifier) => {
    const imported = new Set(outsideCore.flatMap((source) => namesImported(source, specifier)));
    expect(imported.size).toBeGreaterThan(0);
    expect(barrelNames(barrel)).toEqual([...imported].sort());
  });
});
