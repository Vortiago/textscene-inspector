import { describe, expect, it } from 'vitest';
import { takeRecordedTiers } from './titleTier';
import { errorsOf, infosOf, reportsOf, warningsOf } from './tierLists';
import type { Diagnostic, Severity } from '../types';

function diagnostic(severity: Severity, ruleName: string): Diagnostic {
  return { severity, ruleName, message: `${ruleName} at ${severity}`, nodeName: 'N', nodeType: 'Node' };
}

const parserError = diagnostic('error', 'strict-parser');
const parserWarning = diagnostic('warning', 'strict-parser');
const ruleError = diagnostic('error', 'some-rule');
const ruleWarning = diagnostic('warning', 'some-rule');
const all = [parserError, parserWarning, ruleError, ruleWarning];

describe('errorsOf, warningsOf and infosOf', () => {
  it('keep the diagnostics at their tier', () => {
    const ruleInfo = diagnostic('info', 'some-rule');

    expect([errorsOf(all), warningsOf(all), infosOf([...all, ruleInfo])]).toEqual([
      [parserError, ruleError],
      [parserWarning, ruleWarning],
      [ruleInfo],
    ]);
  });

  it('narrow to one rule when given its name', () => {
    expect(errorsOf(all, 'strict-parser')).toEqual([parserError]);
  });

  it('return an empty list when nothing is at the tier', () => {
    expect(errorsOf([parserWarning])).toEqual([]);
  });

  it('record their tier when the list they return is non-empty', () => {
    warningsOf(all);

    expect(takeRecordedTiers()).toEqual(['warning']);
  });

  it('record nothing when the list they return is empty', () => {
    errorsOf([parserWarning]);

    expect(takeRecordedTiers()).toEqual([]);
  });
});

describe('reportsOf', () => {
  it("returns a rule's reports when every one is at the tier", () => {
    expect(reportsOf([parserError, ruleWarning], 'some-rule', 'warning')).toEqual([ruleWarning]);
  });

  it("fails when one of the rule's reports is at another tier", () => {
    expect(() => reportsOf(all, 'some-rule', 'warning')).toThrow('some-rule at error');
  });

  it('returns an empty list for a rule that reports nothing', () => {
    expect(reportsOf(all, 'silent-rule', 'info')).toEqual([]);
  });

  it('records its tier when the rule reports', () => {
    reportsOf([parserError, ruleWarning], 'some-rule', 'warning');

    expect(takeRecordedTiers()).toEqual(['warning']);
  });

  it('records nothing for a rule that reports nothing', () => {
    reportsOf(all, 'silent-rule', 'info');

    expect(takeRecordedTiers()).toEqual([]);
  });
});
