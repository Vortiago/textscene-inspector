/**
 * Guard for the React-free linter boundary (ADR-0001) and the split-slice
 * invariant (a parser/linter entry point must never reach a `.tsx` render
 * component). The test walks the static *value*-import closure of each entry
 * point — type-only imports are skipped because the bundler erases them — and
 * asserts:
 *
 *   - `linter/index.ts` reaches no `.tsx` and value-imports no react/three.
 *   - `parser/TscnParser.ts` reaches no `.tsx` render component.
 *
 * So a future contributor who imports `./Component` from `index.ts` /
 * `index.linter.ts` (or points a barrel at `index.r3f.js`) gets a red test,
 * not a silently bloated linter bundle.
 *
 * NOTE: the lenient parser is intentionally NOT asserted three-free. It
 * value-imports `three` through `utils/transform.ts`, which uses
 * `THREE.Matrix4`/`Euler` to decompose a Transform3D at parse time (gimbal-safe
 * extraction — see the comments there). That coupling is acceptable: the parser
 * is only ever consumed alongside the renderer, which bundles three regardless,
 * and the linter (which must stay three-free) uses its own strict parser, not
 * this one. Moving transform decomposition to render time to make the parser
 * pure-data is a tracked deepening candidate, out of scope for the slice
 * unification.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/linter
const srcRoot = resolve(here, '..'); // .../src

const FORBIDDEN_BARE = [/^react$/, /^react-dom(\/.*)?$/, /^@react-three\//, /^three$/, /^three\//];

/** Resolve a relative import/export specifier to an on-disk source file. */
function resolveLocal(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), spec);
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
}

function walkClosure(entry: string): Closure {
  const files = new Set<string>();
  const bareValueImports = new Set<string>();
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    const src = readFileSync(file, 'utf8');
    const re = new RegExp(SPEC_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const isTypeOnly = m[2] !== undefined; // `import type` / `export type`
      if (isTypeOnly) continue; // erased by the bundler — not part of the runtime closure
      const spec = m[3];
      if (spec.startsWith('.')) {
        const resolved = resolveLocal(file, spec);
        if (resolved) stack.push(resolved);
      } else {
        bareValueImports.add(spec);
      }
    }
  }
  return { files, bareValueImports };
}

function forbiddenBare(closure: Closure): string[] {
  return [...closure.bareValueImports].filter((s) => FORBIDDEN_BARE.some((re) => re.test(s)));
}

function tsxFiles(closure: Closure): string[] {
  return [...closure.files].filter((f) => f.endsWith('.tsx'));
}

describe('React-free boundary (ADR-0001)', () => {
  it('linter entry point reaches no .tsx render component', () => {
    const closure = walkClosure(resolve(here, 'index.ts'));
    expect(tsxFiles(closure)).toEqual([]);
  });

  it('linter entry point value-imports no react/three', () => {
    const closure = walkClosure(resolve(here, 'index.ts'));
    expect(forbiddenBare(closure)).toEqual([]);
  });

  it('lenient parser barrel reaches no .tsx render component', () => {
    const closure = walkClosure(resolve(srcRoot, 'parser/TscnParser.ts'));
    expect(tsxFiles(closure)).toEqual([]);
  });

  it('lenient parser barrel value-imports no react/react-three', () => {
    // The parser legitimately reaches `three` via transform decomposition
    // (see file header), but must never pull in react or react-three-fiber.
    const closure = walkClosure(resolve(srcRoot, 'parser/TscnParser.ts'));
    const reactish = [...closure.bareValueImports].filter((s) =>
      /^react$|^react-dom(\/.*)?$|^@react-three\//.test(s)
    );
    expect(reactish).toEqual([]);
  });
});
