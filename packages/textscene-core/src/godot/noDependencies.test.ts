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

/**
 * Every non-test source file in this directory TREE.
 *
 * Recursive, because the flat listing filtered a subdirectory out as "not a
 * `.ts`" and never opened it — so one file under `godot/tiles/` could import
 * three and stay green while becoming the bridge that carries it into every
 * bundle reading `CMP_EPSILON`.
 */
function sourceFiles(dir: string = here, prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) found.push(...sourceFiles(resolve(dir, entry.name), `${name}/`));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) found.push(name);
  }
  return found.sort();
}

/**
 * Any `import`/`export … from` specifier, `import type` included, plus bare
 * side-effect imports and dynamic `import()`.
 *
 * The clause between the keyword and `from` is `[^;]*?`, not `[^\n;]*?`: a
 * braced specifier list spans lines, which is the form most of this directory
 * uses, and a newline-bounded class saw none of them.
 */
const IMPORT_RE =
  /(?:^|\n)\s*(?:import|export)\b[^;]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

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

  it('sees a multi-line specifier list, the form this directory mostly uses', () => {
    expect(specifiersIn("import {\n  Mesh,\n  Vector3,\n} from 'three';")).toEqual(['three']);
    expect(specifiersIn("import type {\n  P,\n} from '../linter/types.js';")).toEqual([
      '../linter/types.js',
    ]);
    expect(specifiersIn("export {\n  a,\n  b,\n} from './math.js';")).toEqual(['./math.js']);
  });

  it('sees every specifier this directory actually writes', () => {
    // index.ts re-exports each sibling through a braced multi-line block, so a
    // scraper blind to those reads the barrel as importing nothing.
    const specs = specifiersIn(readFileSync(resolve(here, 'index.ts'), 'utf8'));
    for (const sibling of ['./number.js', './int.js', './variantParser.js', './rendering.js']) {
      expect(specs).toContain(sibling);
    }
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
