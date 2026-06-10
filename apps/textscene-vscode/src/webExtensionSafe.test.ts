/**
 * Web-extension-host safety guard.
 *
 * vscode.dev (and `--browser` test runs) load `dist/extension.web.js` in a
 * web worker. A web worker has no Node builtins and no DOM, and the host
 * bundle must stay framework-free — react/three belong to the webview
 * bundle, never the host. The esbuild `platform: 'browser'` web build fails
 * loudly on Node builtins, but only when that build runs; this test makes
 * the same boundary a unit-test failure on every `pnpm test:unit`.
 *
 * Modeled on `packages/textscene-core/src/linter/reactFree.test.ts`: walk
 * the static *value*-import closure of `src/extension.ts` (type-only
 * imports are skipped — the bundler erases them), following relative
 * imports and `@textscene/core/*` subpaths into the core package's `src/`.
 * Excluded from the walk: `*.test.ts` files and the `webview/` subtree
 * (the webview is a browser DOM bundle by design; the only host-side file
 * there, `webviewHtml.ts`, has no imports).
 *
 * The host closure is fully framework-free: `utils/transform.ts` decomposes
 * Transform3D with pure math (bit-equivalent to the former three.js path,
 * pinned by core's transform.threeEquivalence.test.ts), so `three` is
 * asserted absent below alongside react.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // .../apps/textscene-vscode/src
const repoRoot = resolve(here, '../../..');
const coreSrc = resolve(repoRoot, 'packages/textscene-core/src');
const webviewDir = resolve(here, 'webview') + sep;

// The ONLY external value-import a web extension host may have: the
// `vscode` API module is injected by the host runtime (worker or Node).
// Everything else must be bundled workspace source — a web worker has no
// module loader and no Node builtins to fall back on.
const ALLOWED_EXTERNALS = new Set(['vscode']);

// Node builtins that cannot exist in a web-worker host, bare or
// 'node:'-prefixed, including subpaths (fs/promises, stream/web, ...).
const NODE_BUILTIN_RE =
  /^(node:)?(fs|path|os|child_process|crypto|http|https|net|stream|util|url|zlib|worker_threads)(\/.*)?$/;

// Frameworks that belong to the webview bundle, never the host.
const FRAMEWORK_RE = [/^react$/, /^react-dom(\/.*)?$/, /^@react-three\//, /^three$/, /^three\//];

/** Resolve a relative or @textscene/core import specifier to a source file. */
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
  /** bare specifier -> repo-relative importer files */
  bareValueImports: Map<string, Set<string>>;
  /** workspace specifiers the resolver could not map to a file */
  unresolved: string[];
}

function isExcluded(file: string): boolean {
  return file.endsWith('.test.ts') || file.startsWith(webviewDir);
}

function walkClosure(entry: string): Closure {
  const files = new Set<string>();
  const bareValueImports = new Map<string, Set<string>>();
  const unresolved: string[] = [];
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop()!;
    if (files.has(file) || isExcluded(file)) continue;
    files.add(file);
    const src = readFileSync(file, 'utf8');
    const re = new RegExp(SPEC_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const isTypeOnly = m[2] !== undefined; // `import type` / `export type`
      if (isTypeOnly) continue; // erased by the bundler — not in the runtime closure
      const spec = m[3]!;
      const isWorkspace = spec.startsWith('.') || spec.startsWith('@textscene/core');
      const resolved = resolveWorkspace(file, spec);
      if (resolved) {
        stack.push(resolved);
      } else if (isWorkspace) {
        unresolved.push(`${spec} (from ${relative(repoRoot, file)})`);
      } else {
        let importers = bareValueImports.get(spec);
        if (!importers) bareValueImports.set(spec, (importers = new Set()));
        importers.add(relative(repoRoot, file));
      }
    }
  }
  return { files, bareValueImports, unresolved };
}

function bareSpecs(closure: Closure): string[] {
  return [...closure.bareValueImports.keys()].sort();
}

describe('web extension host boundary (vscode.dev web worker)', () => {
  const closure = walkClosure(resolve(here, 'extension.ts'));

  it('walker resolves every workspace import (guard stays exhaustive)', () => {
    expect(closure.unresolved).toEqual([]);
  });

  it('host closure imports no Node builtin (bare or node:-prefixed)', () => {
    const builtins = bareSpecs(closure).filter((s) => NODE_BUILTIN_RE.test(s));
    expect(builtins).toEqual([]);
  });

  it('host closure imports no react/react-dom/@react-three/three', () => {
    const frameworks = bareSpecs(closure).filter((s) =>
      FRAMEWORK_RE.some((re) => re.test(s))
    );
    expect(frameworks).toEqual([]);
  });

  it('host closure reaches no .tsx render component', () => {
    const tsx = [...closure.files].filter((f) => f.endsWith('.tsx'));
    expect(tsx).toEqual([]);
  });

  it('the only other external value import is vscode', () => {
    const externals = bareSpecs(closure).filter(
      (s) => !ALLOWED_EXTERNALS.has(s) && !FRAMEWORK_RE.some((re) => re.test(s))
    );
    expect(externals).toEqual([]);
  });
});
