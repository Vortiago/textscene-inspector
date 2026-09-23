/**
 * The React-free linter boundary (ADR-0001) and the split-slice rule: neither
 * `linter/index.ts` nor `parser/TscnParser.ts` reaches a `.tsx` or value-imports
 * react or three. It walks each static value-import closure, skipping type-only
 * imports, which the bundler erases. `three` enters only through the r3f layer.
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

// One walk per entry point, shared across assertions: the closure spans the
// whole linter and parser surface, a full synchronous fs sweep.
const linterClosure = walkImportClosure(resolve(here, 'index.ts'));
const parserClosure = walkImportClosure(resolve(srcRoot, 'parser/TscnParser.ts'));

describe('React-free boundary (ADR-0001)', () => {
  // An unresolvable specifier is not followed, so every file under it drops out
  // of the closure and the four assertions below report clean over a subtree
  // nothing walked. The walker must not go blind.
  it('walker resolves every workspace import (guard stays exhaustive)', () => {
    expect(linterClosure.unresolved).toEqual([]);
    expect(parserClosure.unresolved).toEqual([]);
  });

  // A walk that follows nothing reports no unresolved specifier either, so a
  // closure of the entry file alone satisfies every assertion below. The floors
  // sit near half the real size: low enough for a refactor, high enough to
  // fail on a collapse.
  it('walked both closures rather than stopping at the entry file', () => {
    expect(linterClosure.files.size).toBeGreaterThan(400);
    expect(parserClosure.files.size).toBeGreaterThan(250);
  });

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
