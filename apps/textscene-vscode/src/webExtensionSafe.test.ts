/**
 * vscode.dev loads `dist/extension.web.js` in a web worker, with no Node builtins,
 * no DOM and no react/three. The browser build fails on a builtin only when it
 * runs, so this walks the value-import closure of `src/extension.ts` on every
 * unit run. Type-only imports are skipped: the bundler erases them.
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

// The host runtime injects `vscode`. Everything else is bundled workspace source,
// since a web worker has no module loader and no Node builtins.
const ALLOWED_EXTERNALS = new Set(['vscode']);

describe('web extension host boundary (vscode.dev web worker)', () => {
  // The webview subtree is a browser DOM bundle, and its one host-side file,
  // `webviewHtml.ts`, imports nothing. `@textscene/core/*` resolves into core's src.
  const closure = walkImportClosure(resolve(here, 'extension.ts'), {
    packageAliases: { '@textscene/core': coreSrc },
    exclude: (file) => file.endsWith('.test.ts') || file.startsWith(webviewDir),
    relativeTo: repoRoot,
  });

  it('walker resolves every workspace import (guard stays exhaustive)', () => {
    // A closure collapsed to the entry file passes every emptiness check here, so
    // the floor catches a walker that stopped following. It is inline because core
    // publishes no test-helper subpath and this app cannot deep-import past its
    // exports map.
    expect(closure.files.size).toBeGreaterThan(700);
    expect(closure.unresolved).toEqual([]);
  });

  it('host closure imports no Node builtin (bare or node:-prefixed)', () => {
    const builtins = bareSpecifiers(closure).filter((s) => NODE_BUILTIN_RE.test(s));
    expect(builtins).toEqual([]);
  });

  // `utils/transform.ts` decomposes Transform3D with pure math, pinned against
  // three.js by core's transform.threeEquivalence.test.ts, so the host needs no three.
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
