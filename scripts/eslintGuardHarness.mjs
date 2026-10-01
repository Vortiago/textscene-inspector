/**
 * The shared harness for the `no-restricted-syntax` guard tests: what the repo's ESLint config
 * resolves for a file, and what that setting reports on a code sample.
 */

import { ESLint, Linter } from 'eslint';
import tsparser from '@typescript-eslint/parser';
import { findRepoRoot } from './repoRoot.mjs';

const eslint = new ESLint({ cwd: findRepoRoot() });

/** The `no-restricted-syntax` setting the repo's config resolves for `file`, or undefined. */
export async function restrictedSyntaxFor(file) {
  const config = await eslint.calculateConfigForFile(file);
  return config.rules?.['no-restricted-syntax'];
}

/** The rule ids that `file`'s setting reports on `code`, parsed as the core package's TypeScript is. */
export async function reportedOn(code, file) {
  const setting = await restrictedSyntaxFor(file);
  const linter = new Linter({ configType: 'flat' });
  const config = [
    { files: ['**/*.ts'], languageOptions: { parser: tsparser }, rules: { 'no-restricted-syntax': setting } },
  ];
  return linter.verify(code, config, 'sample.ts').map((message) => message.ruleId);
}
