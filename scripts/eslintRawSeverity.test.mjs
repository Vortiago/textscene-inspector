/**
 * The ESLint guard on a raw tier assertion in a core test: `expect(d.severity)` records no tier,
 * so the setup file's title check cannot see it. `toBeAtTier` asserts the same and records.
 */

import { describe, expect, it } from 'vitest';
import { reportedOn as reportedOnFile, restrictedSyntaxFor } from './eslintGuardHarness.mjs';

const CORE_TEST = 'packages/textscene-core/src/linter/ValidatorRegistry.shadowCopies.test.ts';
const CORE_SOURCE = 'packages/textscene-core/src/linter/testing/tierLists.ts';

const reportedOn = (code) => reportedOnFile(code, CORE_TEST);

describe('the raw tier assertion guard', () => {
  it('applies to a core test file', async () => {
    expect(await restrictedSyntaxFor(CORE_TEST)).toBeDefined();
  });

  it('leaves a core source module alone, where tierLists.ts reads a tier to filter on it', async () => {
    expect(await reportedOnFile("expect(report.severity).toBe('error');", CORE_SOURCE)).toEqual([]);
  });

  it('refuses a severity read as the subject of expect', async () => {
    expect(await reportedOn("expect(d.severity).toBe('error');")).toEqual(['no-restricted-syntax']);
  });

  it('refuses an optional or non-null severity read, and one with a message', async () => {
    const code = [
      "expect(check('x', '1')?.severity).toBe('warning');",
      "expect(errors[0]!.severity, 'first').toBe('error');",
    ].join('\n');
    expect(await reportedOn(code)).toEqual(['no-restricted-syntax', 'no-restricted-syntax']);
  });

  it('accepts the recording matcher and a severity read anywhere else', async () => {
    const code = [
      "expect(d).toBeAtTier('error');",
      'const tiers = diagnostics.map((x) => x.severity);',
      "expect(diagnostics.map((x) => [x.ruleName, x.severity])).toEqual([['r', 'error']]);",
    ].join('\n');
    expect(await reportedOn(code)).toEqual([]);
  });
});
