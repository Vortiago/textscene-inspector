/**
 * The ESLint rule-arm guard in `eslint.config.js`. A rule reports only through a declared arm
 * (`linter/ruleArms.ts`). An object with a `ruleName` and no `grounding` is a hand-written
 * diagnostic that `emits` cannot see.
 */

import { describe, expect, it } from 'vitest';
import { ESLint, Linter } from 'eslint';
import tsparser from '@typescript-eslint/parser';
import { findRepoRoot } from './repoRoot.mjs';

const eslint = new ESLint({ cwd: findRepoRoot() });

const CORE = 'packages/textscene-core/src';
const SLICE_RULE = `${CORE}/nodes/timers/timer/linter.ts`;
const PHYSICS_RULE = `${CORE}/linter/physics/areaLinterRule.ts`;
/** Not rules: `Linter.ts` takes a parse error's tier from the error, `ruleArms.ts` is the arm API, and `testkit.ts` builds expectations. */
const EXEMPT = [`${CORE}/linter/Linter.ts`, `${CORE}/linter/ruleArms.ts`, `${CORE}/linter/testing/testkit.ts`];
const RULE_TEST = `${CORE}/nodes/timers/timer/linter.test.ts`;

/** The `no-restricted-syntax` selectors the repo's config resolves for `file`. */
async function selectorsFor(file) {
  const config = await eslint.calculateConfigForFile(file);
  const [, ...options] = config.rules?.['no-restricted-syntax'] ?? [];
  return options.map((option) => option.selector);
}

async function guardsRuleName(file) {
  return (await selectorsFor(file)).some((selector) => selector.includes('ruleName'));
}

/** The ids of the rules that report on `code`, under the config ESLint resolves for a slice rule. */
async function reportedOn(code) {
  const config = await eslint.calculateConfigForFile(SLICE_RULE);
  const linter = new Linter({ configType: 'flat' });
  const flat = [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsparser },
      rules: { 'no-restricted-syntax': config.rules['no-restricted-syntax'] },
    },
  ];
  return linter.verify(code, flat, 'sample.ts').map((message) => message.ruleId);
}

describe('the rule-arm guard', () => {
  it('applies to a slice rule and to a physics factory', async () => {
    expect(await guardsRuleName(SLICE_RULE)).toBe(true);
    expect(await guardsRuleName(PHYSICS_RULE)).toBe(true);
  });

  it('keeps the registerAll guard on a rule file', async () => {
    // A later config block's options replace an earlier block's for a file both match.
    expect((await selectorsFor(SLICE_RULE)).some((selector) => selector.includes('registerAll'))).toBe(true);
  });

  it('skips the modules that are not rules, and the test files', async () => {
    for (const file of [...EXEMPT, RULE_TEST]) expect(await guardsRuleName(file)).toBe(false);
  });

  it('refuses a hand-written diagnostic', async () => {
    const code = "diagnostics.push({ severity: 'warning', message: m, nodeName: n, nodeType: t, ruleName: 'x-y' });";
    expect(await reportedOn(code)).toEqual(['no-restricted-syntax']);
  });

  it('refuses a shorthand ruleName', async () => {
    expect(await reportedOn("const d = { severity: 'warning', ruleName };")).toEqual(['no-restricted-syntax']);
  });

  it('accepts an arm, which carries its grounding', async () => {
    const code = "const arms = { a: { severity: 'warning', ruleName: 'x-y', grounding: { kind: 'configuration-warning' } } };";
    expect(await reportedOn(code)).toEqual([]);
  });
});
