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
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  walkImportClosure,
  bareSpecifiers,
  tsxFiles,
  FRAMEWORK_BARE_RE,
  NODE_BUILTIN_RE,
} from '@textscene/dev-kit';

const here = dirname(fileURLToPath(import.meta.url)); // .../apps/textscene-vscode/src
const repoRoot = resolve(here, '../../..');
const coreSrc = resolve(repoRoot, 'packages/textscene-core/src');
const webviewDir = resolve(here, 'webview') + sep;

// The ONLY external value-import a web extension host may have: the
// `vscode` API module is injected by the host runtime (worker or Node).
// Everything else must be bundled workspace source — a web worker has no
// module loader and no Node builtins to fall back on.
const ALLOWED_EXTERNALS = new Set(['vscode']);

describe('web extension host boundary (vscode.dev web worker)', () => {
  // Exclude the webview subtree (a browser DOM bundle by design) and test
  // files. `@textscene/core/*` subpaths resolve into the core package's src.
  const closure = walkImportClosure(resolve(here, 'extension.ts'), {
    packageAliases: { '@textscene/core': coreSrc },
    exclude: (file) => file.endsWith('.test.ts') || file.startsWith(webviewDir),
    relativeTo: repoRoot,
  });

  it('walker resolves every workspace import (guard stays exhaustive)', () => {
    expect(closure.unresolved).toEqual([]);
  });

  it('host closure imports no Node builtin (bare or node:-prefixed)', () => {
    const builtins = bareSpecifiers(closure).filter((s) => NODE_BUILTIN_RE.test(s));
    expect(builtins).toEqual([]);
  });

  it('host closure imports no react/react-dom/@react-three/three', () => {
    const frameworks = bareSpecifiers(closure).filter((s) =>
      FRAMEWORK_BARE_RE.some((re) => re.test(s))
    );
    expect(frameworks).toEqual([]);
  });

  it('host closure reaches no .tsx render component', () => {
    expect(tsxFiles(closure)).toEqual([]);
  });

  it('the only other external value import is vscode', () => {
    const externals = bareSpecifiers(closure).filter(
      (s) => !ALLOWED_EXTERNALS.has(s) && !FRAMEWORK_BARE_RE.some((re) => re.test(s))
    );
    expect(externals).toEqual([]);
  });
});
