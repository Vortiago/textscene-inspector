/**
 * The ESLint guard on `registerAll` in `eslint.config.js`: a spread inside its arguments merges a
 * validator table's parts last-wins, before the registry can refuse a key two parts share.
 */

import { describe, expect, it } from 'vitest';
import { ESLint, Linter } from 'eslint';
import tsparser from '@typescript-eslint/parser';
import { findRepoRoot } from './repoRoot.mjs';

const eslint = new ESLint({ cwd: findRepoRoot() });

const CORE_SOURCE = 'packages/textscene-core/src/nodes/2d/ui/control/linterParser.ts';
const CORE_TEST = 'packages/textscene-core/src/linter/ValidatorRegistry.shadowCopies.test.ts';

/** The `no-restricted-syntax` setting the repo's config resolves for `file`, or undefined. */
async function restrictedSyntaxFor(file) {
  const config = await eslint.calculateConfigForFile(file);
  return config.rules?.['no-restricted-syntax'];
}

/** The rule ids that setting reports on `code`, parsed as the core package's TypeScript is. */
async function reportedOn(code) {
  const setting = await restrictedSyntaxFor(CORE_SOURCE);
  const linter = new Linter({ configType: 'flat' });
  const config = [
    { files: ['**/*.ts'], languageOptions: { parser: tsparser }, rules: { 'no-restricted-syntax': setting } },
  ];
  return linter.verify(code, config, 'sample.ts').map((message) => message.ruleId);
}

describe('the registerAll spread guard', () => {
  it('applies to a core source module', async () => {
    expect(await restrictedSyntaxFor(CORE_SOURCE)).toBeDefined();
  });

  it('leaves a test file alone, where a registry test spreads a shared group on purpose', async () => {
    expect(await restrictedSyntaxFor(CORE_TEST)).toBeUndefined();
  });

  it('refuses an object spread inside a registerAll argument', async () => {
    expect(await reportedOn("validatorRegistry.registerAll('A', { ...keys, a: v.int('a') });")).toEqual([
      'no-restricted-syntax',
    ]);
  });

  it('refuses a spread argument to a bare registerAll call', async () => {
    expect(await reportedOn("registerAll('A', ...groups);")).toEqual(['no-restricted-syntax']);
  });

  it('accepts the parts as separate arguments, and a spread outside the call', async () => {
    const code = [
      'const merged = { ...keys };',
      "validatorRegistry.registerAll('A', keys, { a: v.int('a') }, merged);",
    ].join('\n');
    expect(await reportedOn(code)).toEqual([]);
  });
});
