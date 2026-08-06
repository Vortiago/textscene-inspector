/**
 * Guard for `src/godot/`'s defining property: it imports NOTHING.
 *
 * The module exists so linter, parser, resources and nodes can all share an
 * engine fact without importing each other. That only holds while it is a leaf.
 * One import of `../linter/validators/propertyError.js` would make every
 * resource file that reads `CMP_EPSILON` pull the linter's diagnostic machinery
 * into the render bundle — the exact coupling the module was created to remove,
 * reintroduced invisibly, since nothing about the call site would change.
 *
 * Bare specifiers are banned alongside relative ones: a dependency on `three` or
 * on a util package is still a dependency, and `node:` builtins would make the
 * module unusable in the webview.
 *
 * Type-only imports are banned too, unlike in `reactFree.test.ts`. There the
 * bundler erases them so they cost nothing; here the point is not bundle weight
 * but that this module answers to no other domain's vocabulary, and a
 * `import type { ParseError }` would tie it to one just as firmly.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/godot

/** Every non-test source file in this directory. */
function sourceFiles(): string[] {
  return readdirSync(here)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .sort();
}

/**
 * Any `import`/`export … from` specifier, `import type` included, plus bare
 * side-effect imports and dynamic `import()`.
 */
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\b[^\n;]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function specifiersIn(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2] ?? match[3];
    if (spec) found.push(spec);
  }
  return found;
}

describe('src/godot is a dependency-free leaf', () => {
  it('finds the source files, so the sweep cannot pass vacuously', () => {
    expect(sourceFiles()).toContain('math.ts');
    expect(sourceFiles()).toContain('index.ts');
  });

  it('detects an import when one is present, before trusting its silence', () => {
    expect(specifiersIn("import { x } from './linter/y.js';")).toEqual(['./linter/y.js']);
    expect(specifiersIn("import type { P } from '../linter/types.js';")).toEqual([
      '../linter/types.js',
    ]);
    expect(specifiersIn("import 'three';")).toEqual(['three']);
    expect(specifiersIn("export { a } from './math.js';")).toEqual(['./math.js']);
    expect(specifiersIn("const m = await import('node:fs');")).toEqual(['node:fs']);
  });

  it('imports nothing outside this directory', () => {
    const violations: string[] = [];
    for (const name of sourceFiles()) {
      for (const spec of specifiersIn(readFileSync(resolve(here, name), 'utf8'))) {
        // A sibling inside this directory is the one legal specifier: `index.ts`
        // re-exports `./math.js`, and the module is allowed its own shape.
        const isLocalSibling = /^\.\/[\w.-]+\.js$/.test(spec);
        if (!isLocalSibling) violations.push(`${name} imports '${spec}'`);
      }
    }
    expect(
      violations,
      'src/godot must import nothing — see this file\'s docblock for why'
    ).toEqual([]);
  });
});
