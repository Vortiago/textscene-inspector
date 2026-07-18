import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  bareSpecifiers,
  tsxFiles,
  walkImportClosure,
  FRAMEWORK_BARE_RE,
  NODE_BUILTIN_RE,
} from './importClosure';

let root: string;

/** Write a `{ relativePath: source }` map into the fixture root. */
function writeTree(files: Record<string, string>): void {
  for (const [rel, src] of Object.entries(files)) {
    const abs = resolve(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, src, 'utf8');
  }
}

beforeAll(() => {
  root = mkdtempSync(resolve(tmpdir(), 'devkit-closure-'));
  writeTree({
    'entry.ts': [
      "import { b } from './b';",
      "import './effect';",
      "import type { T } from './typeonly';",
      "import react from 'react';",
      "import { readFileSync } from 'node:fs';",
      "export { r } from './renamed.js';",
      "import { lib } from '@scope/pkg';",
      "import { deep } from '@scope/pkg/deep';",
      "import { missing } from './nope';",
      'export const value: number = 1;',
    ].join('\n'),
    'b.ts': "import { c } from './nested/c';\nexport const b = c;",
    'nested/c.ts': 'export const c = 1;',
    'effect.ts': 'globalThis.effect = true;',
    'typeonly.ts': 'export type T = string;\nimport three from "three";',
    'renamed.ts': 'export const r = 1;',
    'pkgRoot/index.ts': "export const lib = 'lib';",
    'pkgRoot/deep.ts': "export const deep = 'deep';",
    'component.tsx': 'export const C = () => null;',
    'withComponent.ts': "import { C } from './component';\nexport const use = C;",
    'lazy.ts': [
      "export async function load() {",
      "  const three = await import('three');",
      "  const local = await import('./nested/c');",
      "  return { three, local };",
      "}",
    ].join('\n'),
    'lazyTypeOnly.ts': [
      "// A doc mention of import('react-dom') must not enter the closure.",
      "/* Nor import('./component') inside a block comment. */",
      "type Loader = typeof import('react')['createElement'];",
      "export const marker: Loader | null = null;",
    ].join('\n'),
  });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

const aliases = (): Record<string, string> => ({ '@scope/pkg': resolve(root, 'pkgRoot') });

describe('walkImportClosure', () => {
  it('follows relative value imports, side-effect imports, and export…from', () => {
    const closure = walkImportClosure(resolve(root, 'entry.ts'), { packageAliases: aliases() });
    expect(closure.files).toContain(resolve(root, 'entry.ts'));
    expect(closure.files).toContain(resolve(root, 'b.ts'));
    expect(closure.files).toContain(resolve(root, 'nested/c.ts'));
    expect(closure.files).toContain(resolve(root, 'effect.ts'));
    expect(closure.files).toContain(resolve(root, 'renamed.ts'));
  });

  it('skips type-only imports (bundler erases them)', () => {
    const closure = walkImportClosure(resolve(root, 'entry.ts'), { packageAliases: aliases() });
    // The type-only `./typeonly` is never read, so its own `three` import stays out.
    expect(closure.files).not.toContain(resolve(root, 'typeonly.ts'));
    expect(bareSpecifiers(closure)).not.toContain('three');
  });

  it('records bare externals with their importer files', () => {
    const closure = walkImportClosure(resolve(root, 'entry.ts'), {
      packageAliases: aliases(),
      relativeTo: root,
    });
    expect(closure.bareValueImports.get('react')).toEqual(new Set(['entry.ts']));
    expect(bareSpecifiers(closure)).toEqual(['node:fs', 'react']);
  });

  it('exposes framework and node-builtin specifiers to the shared filters', () => {
    const closure = walkImportClosure(resolve(root, 'entry.ts'), { packageAliases: aliases() });
    const specs = bareSpecifiers(closure);
    expect(specs.filter((s) => FRAMEWORK_BARE_RE.some((re) => re.test(s)))).toEqual(['react']);
    expect(specs.filter((s) => NODE_BUILTIN_RE.test(s))).toEqual(['node:fs']);
  });

  it('resolves an aliased package root and its subpaths', () => {
    const closure = walkImportClosure(resolve(root, 'entry.ts'), { packageAliases: aliases() });
    expect(closure.files).toContain(resolve(root, 'pkgRoot/index.ts'));
    expect(closure.files).toContain(resolve(root, 'pkgRoot/deep.ts'));
  });

  it('reports a workspace specifier it cannot resolve as unresolved', () => {
    const closure = walkImportClosure(resolve(root, 'entry.ts'), {
      packageAliases: aliases(),
      relativeTo: root,
    });
    expect(closure.unresolved).toEqual(['./nope (from entry.ts)']);
  });

  it('reports reachable .tsx render components via tsxFiles', () => {
    const clean = walkImportClosure(resolve(root, 'b.ts'));
    expect(tsxFiles(clean)).toEqual([]);
    const dirty = walkImportClosure(resolve(root, 'withComponent.ts'));
    expect(tsxFiles(dirty)).toEqual([resolve(root, 'component.tsx')]);
  });

  it('applies exclude at pop time so an excluded file and its imports stay out', () => {
    const closure = walkImportClosure(resolve(root, 'withComponent.ts'), {
      exclude: (f) => f.endsWith('component.tsx'),
    });
    expect(closure.files).not.toContain(resolve(root, 'component.tsx'));
    expect(tsxFiles(closure)).toEqual([]);
  });

  it('follows literal dynamic import() expressions — lazy chunks still ship the module', () => {
    const closure = walkImportClosure(resolve(root, 'lazy.ts'));
    expect(closure.files).toContain(resolve(root, 'nested/c.ts'));
    expect(bareSpecifiers(closure)).toContain('three');
  });

  it('skips typeof import() annotations and import() inside comments — both erased/inert', () => {
    const closure = walkImportClosure(resolve(root, 'lazyTypeOnly.ts'));
    expect(bareSpecifiers(closure)).toEqual([]);
    expect(closure.files).not.toContain(resolve(root, 'component.tsx'));
  });

  it('throws when the entry file does not exist', () => {
    expect(() => walkImportClosure(resolve(root, 'does-not-exist.ts'))).toThrow();
  });

  it('visits each file once when the graph has a shared dependency', () => {
    writeTree({
      'diamond/top.ts': "import './left';\nimport './right';",
      'diamond/left.ts': "import './shared';",
      'diamond/right.ts': "import './shared';",
      'diamond/shared.ts': 'export const s = 1;',
    });
    const closure = walkImportClosure(resolve(root, 'diamond/top.ts'));
    expect(closure.files).toContain(resolve(root, 'diamond/shared.ts'));
    expect(closure.files.size).toBe(4);
  });
});
