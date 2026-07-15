/**
 * Unit tests for the pure token-scanning logic behind the VS Code extension
 * HOST-bundle guard: `dist/extension.js` and
 * `dist/extension.web.js` must never contain `react`/`three` — a host file
 * that reaches for the root `@textscene/core` barrel (instead of the
 * React-free `/parser`, `/linter`, `/logger` subpaths) balloons the bundle
 * ~4x (see ARCHITECTURE.md, "Bundle Size Target").
 *
 * `findHostBundleViolations` is exercised directly against synthetic bundle
 * content so the test doesn't need a real esbuild run, and — per the TDD
 * anti-pattern warning against tautological string-includes tests — each
 * case is chosen so a naive `content.includes('react')` would give the
 * WRONG answer: common English/code words containing "react"/"three" as a
 * substring (but not as a whole word) must NOT trip the guard.
 */
import { describe, expect, it } from 'vitest';
import { findForbiddenHostInputs, findHostBundleViolations } from './check-bundle-size.mjs';

describe('findHostBundleViolations (host-bundle react/three guard)', () => {
  it('returns no violations for clean Node/host bundle content', () => {
    const content = 'const vscode=require("vscode");function activate(ctx){return ctx}';
    expect(findHostBundleViolations(content)).toEqual([]);
  });

  it('flags a bare `require("react")` import', () => {
    const content = 'var React=require("react");';
    expect(findHostBundleViolations(content)).toEqual(['react']);
  });

  it('flags a static `from "three"` import', () => {
    const content = 'import*as THREE from"three";';
    expect(findHostBundleViolations(content)).toEqual(['three']);
  });

  it('flags both tokens when both are present', () => {
    const content = 'require("react-dom");require("three/examples/jsm/loaders/GLTFLoader.js");';
    expect(findHostBundleViolations(content)).toEqual(['react', 'three']);
  });

  it('does NOT flag words that merely contain "react" or "three" as a substring', () => {
    // "reactive"/"reaction"/"overreacted" contain "react"; "threefold"/
    // "threescore" contain "three" — none of these are the bundled packages.
    const content =
      'function onReactiveChange(){}\n' +
      '// in reaction to a file change, overreacted and rebuilt\n' +
      'const threefold = 3, threescore = 60;';
    expect(findHostBundleViolations(content)).toEqual([]);
  });
});

describe('findForbiddenHostInputs (metafile-based host-bundle guard — the primary, exact check)', () => {
  it('returns nothing for a host bundle built only from source + React-free deps', () => {
    const metafile = {
      inputs: {
        'apps/textscene-vscode/src/extension.ts': { bytes: 100 },
        'packages/textscene-core/src/parser/TscnParserCore.ts': { bytes: 100 },
        'node_modules/.pnpm/some-lib@1.0.0/node_modules/some-lib/index.js': { bytes: 100 },
      },
    };
    expect(findForbiddenHostInputs(metafile)).toEqual([]);
  });

  it('flags bundled react/three modules, including pnpm-nested layouts', () => {
    const metafile = {
      inputs: {
        'apps/textscene-vscode/src/extension.ts': { bytes: 100 },
        'node_modules/.pnpm/react@18.3.1/node_modules/react/index.js': { bytes: 100 },
        'node_modules/three/build/three.module.js': { bytes: 100 },
        'node_modules/.pnpm/@react-three+fiber@8.0.0/node_modules/@react-three/fiber/dist/index.js': {
          bytes: 100,
        },
      },
    };
    expect(findForbiddenHostInputs(metafile)).toEqual([
      'node_modules/.pnpm/react@18.3.1/node_modules/react/index.js',
      'node_modules/three/build/three.module.js',
      'node_modules/.pnpm/@react-three+fiber@8.0.0/node_modules/@react-three/fiber/dist/index.js',
    ]);
  });

  it('is immune to the token scan\'s false-positive class: source files whose STRINGS contain "three"', () => {
    // A linter message like "expected three arguments" lives in a SOURCE
    // input — its path is not a node_modules react/three module, so the
    // metafile check passes where the raw token scan would hard-fail CI.
    const metafile = {
      inputs: { 'packages/textscene-core/src/linter/someRule.ts': { bytes: 100 } },
    };
    expect(findForbiddenHostInputs(metafile)).toEqual([]);
  });

  it('tolerates a metafile with no inputs map', () => {
    expect(findForbiddenHostInputs({})).toEqual([]);
  });
});
