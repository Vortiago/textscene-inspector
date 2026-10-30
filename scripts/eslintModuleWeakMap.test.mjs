/**
 * The ESLint guard on a module-level `new WeakMap(` in core source: a hand-built cache keyed by an
 * object duplicates `perObject` (utils/perObject.ts).
 */

import { describe, expect, it } from 'vitest';
import { reportedOn as reportedOnFile, restrictedSyntaxFor } from './eslintGuardHarness.mjs';

const CORE_SOURCE = 'packages/textscene-core/src/utils/perObject.ts';
const CORE_RULE_SOURCE = 'packages/textscene-core/src/nodes/2d/ui/control/linterParser.ts';
const CORE_TEST = 'packages/textscene-core/src/linter/ValidatorRegistry.shadowCopies.test.ts';

const reportedOn = (code) => reportedOnFile(code, CORE_SOURCE);

describe('the module-level WeakMap guard', () => {
  it('refuses a top-level const WeakMap', async () => {
    expect(await reportedOn('const cache = new WeakMap();')).toEqual(['no-restricted-syntax']);
  });

  it('refuses an exported or let WeakMap', async () => {
    const code = ['export const cache = new WeakMap();', 'let other = new WeakMap();'].join('\n');
    expect(await reportedOn(code)).toEqual(['no-restricted-syntax', 'no-restricted-syntax']);
  });

  it('keeps the guard in the rule-arm block, whose options replace the core block', async () => {
    expect(await reportedOnFile('const cache = new WeakMap();', CORE_RULE_SOURCE)).toEqual([
      'no-restricted-syntax',
    ]);
  });

  it('accepts a WeakMap inside a function, and perObject at module level', async () => {
    const code = [
      'function make() { const cache = new WeakMap(); return cache; }',
      'const read = perObject((key) => key);',
    ].join('\n');
    expect(await reportedOn(code)).toEqual([]);
  });

  it('leaves a test file alone', async () => {
    expect(await reportedOnFile('const cache = new WeakMap();', CORE_TEST)).toEqual([]);
  });

  it('still applies to a core source module', async () => {
    expect(await restrictedSyntaxFor(CORE_SOURCE)).toBeDefined();
  });
});
