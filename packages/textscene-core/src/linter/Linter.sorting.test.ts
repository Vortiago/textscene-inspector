/**
 * Linter: the order diagnostics come back in: by severity, with the order kept inside one severity.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Linter } from './Linter.js';
import { ruleRegistry } from './RuleRegistry.js';
import type { Diagnostic, LintRule } from './types.js';

const ROOT_ONLY = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

/** A rule emitting one diagnostic, named for the tier and message under test. */
function rule(name: string, severity: Diagnostic['severity'], message: string): LintRule {
  return {
    meta: { name, description: message, category: 'validation' },
    check: () => [{ severity, message, nodeName: 'Root', nodeType: 'Node3D', ruleName: name }],
  };
}

describe('Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Diagnostic Sorting', () => {
    // Derived from what each test registered, so no case leaks a rule into the next through a hand-written roster.
    // `ruleRegistry` is a module singleton, so a case registering outside the `afterEach` beside this reports on every
    // later test in this file. Vitest isolates the module graph per file.
    const registered: string[] = [];

    const register = (...rules: LintRule[]): void => {
      for (const r of rules) {
        ruleRegistry.register(r);
        registered.push(r.meta.name);
      }
    };

    afterEach(() => {
      for (const name of registered.splice(0)) ruleRegistry['rules'].delete(name);
    });

    it('should sort diagnostics by severity (errors first)', () => {
      // Registered in reverse, so the order asserted is the sort's doing.
      register(
        rule('test-warning-rule', 'warning', 'Warning'),
        rule('test-error-rule', 'error', 'Error')
      );

      const severities = linter.lint(ROOT_ONLY).map((d) => d.severity);
      expect(severities.indexOf('error')).toBeLessThan(severities.indexOf('warning'));
    });

    it('ranks a warning above an info, the two tiers nothing else orders', () => {
      // The error/warning pair alone leaves `SEVERITY_ORDER`'s third rank free
      // to move, and it is real order: it decides which message a gutter row
      // shows and which end of the report an advisory lands at.
      register(
        rule('test-info-rule', 'info', 'Info'),
        rule('test-warning-rule', 'warning', 'Warning')
      );

      const messages = linter
        .lint(ROOT_ONLY)
        .filter((d) => d.ruleName.startsWith('test-'))
        .map((d) => d.message);

      expect(messages).toEqual(['Warning', 'Info']);
    });

    it('ranks a severity outside the union last, rather than comparing it to NaN', () => {
      // `SEVERITY_ORDER[<off-union>]` is `undefined` and the subtraction is
      // then `NaN`, which the sort reads as "equal". With the offending rule
      // registered first, an unfloored comparator keeps registration order and
      // the most severe finding is not at the top.
      register(
        rule('test-off-union-rule', 'bogus' as unknown as Diagnostic['severity'], 'Odd'),
        rule('test-error-rule', 'error', 'Error')
      );

      const messages = linter
        .lint(ROOT_ONLY)
        .filter((d) => d.ruleName.startsWith('test-'))
        .map((d) => d.message);

      expect(messages).toEqual(['Error', 'Odd']);
    });

    it('should preserve order within same severity level', () => {
      register(
        rule('test-warning-1', 'warning', 'Warning 1'),
        rule('test-warning-2', 'warning', 'Warning 2')
      );

      // The severity-only comparator is a stable sort, so equal-severity
      // diagnostics keep the order their rules were registered in.
      const warnings = linter.lint(ROOT_ONLY).filter((d) => d.severity === 'warning');
      expect(warnings.map((d) => d.message)).toEqual(['Warning 1', 'Warning 2']);
    });
  });
});
