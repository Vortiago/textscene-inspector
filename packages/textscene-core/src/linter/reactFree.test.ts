/**
 * Guard for the React-free linter boundary (ADR-0001) and the split-slice
 * invariant (a parser/linter entry point must never reach a `.tsx` render
 * component). The test walks the static *value*-import closure of each entry
 * point — type-only imports are skipped because the bundler erases them — and
 * asserts:
 *
 *   - `linter/index.ts` reaches no `.tsx` and value-imports no react/three.
 *   - `parser/TscnParser.ts` reaches no `.tsx` and value-imports no react/three.
 *
 * So a future contributor who imports `./Component` from `index.ts` /
 * `index.linter.ts` (or points a barrel at `index.r3f.js`) gets a red test,
 * not a silently bloated linter bundle.
 *
 * The lenient parser earned its three-free assertion when transform
 * decomposition moved to pure math (`utils/transform.ts`, bit-equivalence
 * pinned by transform.threeEquivalence.test.ts). The parser layer is
 * pure-data end to end; `three` enters only through the r3f layer.
 */

import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  walkImportClosure,
  bareSpecifiers,
  tsxFiles,
  FRAMEWORK_BARE_RE,
} from '@textscene/dev-kit';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/linter
const srcRoot = resolve(here, '..'); // .../src

const frameworkBare = (specs: string[]): string[] =>
  specs.filter((s) => FRAMEWORK_BARE_RE.some((re) => re.test(s)));

// One walk per entry point, shared across assertions — the closure spans the
// whole linter/parser surface, so walking it once per `it` doubles a full
// synchronous fs sweep for nothing.
const linterClosure = walkImportClosure(resolve(here, 'index.ts'));
const parserClosure = walkImportClosure(resolve(srcRoot, 'parser/TscnParser.ts'));

describe('React-free boundary (ADR-0001)', () => {
  it('linter entry point reaches no .tsx render component', () => {
    expect(tsxFiles(linterClosure)).toEqual([]);
  });

  it('linter entry point value-imports no react/three', () => {
    expect(frameworkBare(bareSpecifiers(linterClosure))).toEqual([]);
  });

  it('lenient parser barrel reaches no .tsx render component', () => {
    expect(tsxFiles(parserClosure)).toEqual([]);
  });

  it('lenient parser barrel value-imports no react/three', () => {
    expect(frameworkBare(bareSpecifiers(parserClosure))).toEqual([]);
  });
});
