/**
 * `src/godot/` imports nothing, so linter, parser, resources and nodes share engine facts without
 * importing each other: one import there would carry a domain into every bundle that reads
 * `CMP_EPSILON`. Bare specifiers too (`three`, and `node:` breaks the webview), and type-only imports,
 * unlike `reactFree.test.ts`, as `import type { ParseError }` ties the module to a domain's vocabulary.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/godot

/**
 * Every non-test source file in this directory tree. Recursive, so a file in a subdirectory such as
 * `godot/tiles/` cannot import three unseen.
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
 * Any `import`/`export … from` specifier, `import type` included, plus bare side-effect imports and
 * dynamic `import()`. The clause is `[^;]*?`, not `[^\n;]*?`, as a braced specifier list spans lines.
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
        // Only a specifier inside this directory tree is legal: `index.ts` re-exports `./math.js`,
        // and a subdirectory file reaches its root as `../math.js`. Resolved rather than
        // pattern-matched, so `../../logger.js` is caught however many hops it takes.
        const resolved = resolve(dirname(resolve(here, name)), spec);
        if (!spec.startsWith('.') || relative(here, resolved).startsWith('..')) {
          violations.push(`${name} imports '${spec}'`);
        }
      }
    }
    expect(
      violations,
      'src/godot must import nothing — see this file\'s docblock for why'
    ).toEqual([]);
  });
});
