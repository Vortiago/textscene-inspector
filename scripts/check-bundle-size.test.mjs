/**
 * Tests the token scan and the metafile check behind the extension host-bundle guard:
 * `dist/extension.js` and `dist/extension.web.js` must never contain `react` or `three`. A host
 * file that reaches the root `@textscene/core` barrel, not the React-free `/parser`, `/linter`
 * and `/logger` subpaths, grows the bundle about 4x (ARCHITECTURE.md, "Bundle Size Target").
 */
import { describe, expect, it } from 'vitest';
import { findForbiddenHostInputs, findHostBundleViolations } from './check-bundle-size/hostBundles.mjs';

// Synthetic bundle text, so no esbuild run is needed. Each case defeats a naive
// `content.includes('react')`: a word holding "react" or "three" as a substring must not trip it.
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
    // "reactive", "reaction" and "overreacted" hold "react", and "threefold" and "threescore"
    // hold "three". None is a bundled package.
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
    // A linter message like "expected three arguments" lives in a source input, whose path is no
    // node_modules react/three module, so the metafile check passes where the token scan fails CI.
    const metafile = {
      inputs: { 'packages/textscene-core/src/linter/someRule.ts': { bytes: 100 } },
    };
    expect(findForbiddenHostInputs(metafile)).toEqual([]);
  });

  it('tolerates a metafile with no inputs map', () => {
    expect(findForbiddenHostInputs({})).toEqual([]);
  });
});
