import { describe, expect, it } from 'vitest';
import { errorsOf, reportsOf, warningsOf } from './tierLists';
import type { Diagnostic, Severity } from '../types';

function diagnostic(severity: Severity, ruleName: string): Diagnostic {
  return { severity, ruleName, message: `${ruleName} at ${severity}`, nodeName: 'N', nodeType: 'Node' };
}

const parserError = diagnostic('error', 'strict-parser');
const parserWarning = diagnostic('warning', 'strict-parser');
const ruleError = diagnostic('error', 'some-rule');
const ruleWarning = diagnostic('warning', 'some-rule');
const all = [parserError, parserWarning, ruleError, ruleWarning];

describe('errorsOf and warningsOf', () => {
  it('keep the diagnostics at their tier', () => {
    expect(errorsOf(all)).toEqual([parserError, ruleError]);
    expect(warningsOf(all)).toEqual([parserWarning, ruleWarning]);
  });

  it('narrow to one rule when given its name', () => {
    expect(errorsOf(all, 'strict-parser')).toEqual([parserError]);
  });

  it('return an empty list when nothing is at the tier', () => {
    expect(errorsOf([parserWarning])).toEqual([]);
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
});
