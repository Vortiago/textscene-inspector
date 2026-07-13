/**
 * React-free boundary guard for the linter CLI app.
 *
 * `apps/textscene-linter` must stay React- and three.js-free: it is a plain
 * Node CLI and esbuild bundles it as such (`platform: 'node'`). The guard in
 * `@textscene/core` (`linter/reactFree.test.ts`) only covers `linter/index.ts`
 * — it cannot see an accidental root-barrel `@textscene/core` import added at
 * the app level, because the app layer is outside core's test scope.
 *
 * This test walks the static *value*-import closure of `src/cli.ts` (type-only
 * imports are skipped — the bundler erases them), following relative imports
 * and `@textscene/core/*` subpaths into the core package's `src/`. It asserts:
 *
 *   - No `.tsx` render component is reachable.
 *   - No react / react-dom / @react-three / three bare specifier is value-imported.
 *   - Every workspace import resolves (walker stays exhaustive).
 *
 * Modeled on `apps/textscene-vscode/src/webExtensionSafe.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // .../apps/textscene-linter/src
const repoRoot = resolve(here, '../../..');
const coreSrc = resolve(repoRoot, 'packages/textscene-core/src');

const FORBIDDEN_BARE = [/^react$/, /^react-dom(\/.*)?$/, /^@react-three\//, /^three$/, /^three\//];

/** Resolve a relative or @textscene/core import specifier to an on-disk source file. */
function resolveWorkspace(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('.')) {
    base = resolve(dirname(fromFile), spec);
  } else if (spec === '@textscene/core') {
    base = resolve(coreSrc, 'index');
  } else if (spec.startsWith('@textscene/core/')) {
    base = resolve(coreSrc, spec.slice('@textscene/core/'.length));
  } else {
    return null;
  }
  const candidates: string[] = [];
  if (base.endsWith('.js')) {
    const stem = base.slice(0, -3);
    candidates.push(stem + '.ts', stem + '.tsx');
  } else if (extname(base)) {
    candidates.push(base);
  } else {
    candidates.push(base + '.ts', base + '.tsx');
  }
  candidates.push(resolve(base, 'index.ts'), resolve(base, 'index.tsx'));
  return candidates.find((c) => existsSync(c)) ?? null;
}

// Captures the specifier of any import/export…from and bare side-effect imports.
const SPEC_RE = /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^;'"]*?\sfrom\s*)?['"]([^'"]+)['"]/g;

interface Closure {
  files: Set<string>;
  bareValueImports: Set<string>;
  unresolved: string[];
}

function walkClosure(entry: string): Closure {
  const files = new Set<string>();
  const bareValueImports = new Set<string>();
  const unresolved: string[] = [];
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop()!;
    if (files.has(file) || file.endsWith('.test.ts')) continue;
    files.add(file);
    const src = readFileSync(file, 'utf8');
    const re = new RegExp(SPEC_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const isTypeOnly = m[2] !== undefined; // `import type` / `export type`
      if (isTypeOnly) continue; // erased by the bundler — not part of the runtime closure
      const spec = m[3]!;
      const isWorkspace = spec.startsWith('.') || spec.startsWith('@textscene/core');
      const resolved = resolveWorkspace(file, spec);
      if (resolved) {
        stack.push(resolved);
      } else if (isWorkspace) {
        unresolved.push(`${spec} (from ${relative(repoRoot, file)})`);
      } else {
        bareValueImports.add(spec);
      }
    }
  }
  return { files, bareValueImports, unresolved };
}

function forbiddenBare(closure: Closure): string[] {
  return [...closure.bareValueImports].filter((s) => FORBIDDEN_BARE.some((re) => re.test(s)));
}

describe('linter-app React-free boundary', () => {
  const closure = walkClosure(resolve(here, 'cli.ts'));

  it('walker resolves every workspace import (guard stays exhaustive)', () => {
    expect(closure.unresolved).toEqual([]);
  });

  it('cli closure reaches no .tsx render component', () => {
    const tsx = [...closure.files].filter((f) => f.endsWith('.tsx'));
    expect(tsx).toEqual([]);
  });

  it('cli closure value-imports no react/react-dom/@react-three/three', () => {
    expect(forbiddenBare(closure)).toEqual([]);
  });
});
