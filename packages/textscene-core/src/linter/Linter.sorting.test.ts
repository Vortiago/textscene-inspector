/**
 * Linter: the order diagnostics come back in — by position, then by severity.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Linter } from './Linter.js';
import { ruleRegistry } from './RuleRegistry.js';
import type { Diagnostic, LintRule } from './types.js';

describe('Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Diagnostic Sorting', () => {
    afterEach(() => {
      ruleRegistry['rules'].delete('test-error-rule');
      ruleRegistry['rules'].delete('test-warning-rule');
      ruleRegistry['rules'].delete('test-info-rule');
      ruleRegistry['rules'].delete('test-warning-1');
      ruleRegistry['rules'].delete('test-warning-2');
      ruleRegistry['rules'].delete('test-off-union-rule');
    });

    it('should sort diagnostics by severity (errors first)', () => {
      const errorRule: LintRule = {
        meta: {
          name: 'test-error-rule',
          description: 'Generate error',
          category: 'validation',
        },
        check: () => [{
          severity: 'error',
          message: 'Error',
          nodeName: 'Root',
          nodeType: 'Node3D',
          ruleName: 'test-error-rule',
        }],
      };

      const warningRule: LintRule = {
        meta: {
          name: 'test-warning-rule',
          description: 'Generate warning',
          category: 'validation',
        },
        check: () => [{
          severity: 'warning',
          message: 'Warning',
          nodeName: 'Root',
          nodeType: 'Node3D',
          ruleName: 'test-warning-rule',
        }],
      };

      // Register in reverse order to verify sorting overrides registration order
      ruleRegistry.register(warningRule);
      ruleRegistry.register(errorRule);

      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const diagnostics = linter.lint(content);

      const severities = diagnostics.map(d => d.severity);
      const errorIndex = severities.indexOf('error');
      const warningIndex = severities.indexOf('warning');

      expect(errorIndex).toBeLessThan(warningIndex);
    });

    it('ranks a severity outside the union last, rather than comparing it to NaN', () => {
      // `SEVERITY_ORDER[<off-union>]` is `undefined` and the subtraction is
      // then `NaN`, which the sort reads as "equal" — so with the offending
      // rule registered FIRST, an unfloored comparator hands back registration
      // order and the most severe finding is no longer at the top.
      const oddRule: LintRule = {
        meta: {
          name: 'test-off-union-rule',
          description: 'Generate an unrankable severity',
          category: 'validation',
        },
        check: () => [
          {
            severity: 'bogus' as unknown as Diagnostic['severity'],
            message: 'Odd',
            nodeName: 'Root',
            nodeType: 'Node3D',
            ruleName: 'test-off-union-rule',
          },
        ],
      };

      const errorRule: LintRule = {
        meta: {
          name: 'test-error-rule',
          description: 'Generate error',
          category: 'validation',
        },
        check: () => [
          {
            severity: 'error',
            message: 'Error',
            nodeName: 'Root',
            nodeType: 'Node3D',
            ruleName: 'test-error-rule',
          },
        ],
      };

      ruleRegistry.register(oddRule);
      ruleRegistry.register(errorRule);

      const messages = linter
        .lint(`[gd_scene load_steps=1 format=3]\n\n[node name="Root" type="Node3D"]\n`)
        .filter((d) => d.ruleName.startsWith('test-'))
        .map((d) => d.message);

      expect(messages).toEqual(['Error', 'Odd']);
    });

    it('should preserve order within same severity level', () => {
      const rule1: LintRule = {
        meta: {
          name: 'test-warning-1',
          description: 'Generate warning 1',
          category: 'validation',
        },
        check: () => [{
          severity: 'warning',
          message: 'Warning 1',
          nodeName: 'Root',
          nodeType: 'Node3D',
          ruleName: 'test-warning-1',
        }],
      };

      const rule2: LintRule = {
        meta: {
          name: 'test-warning-2',
          description: 'Generate warning 2',
          category: 'validation',
        },
        check: () => [{
          severity: 'warning',
          message: 'Warning 2',
          nodeName: 'Root',
          nodeType: 'Node3D',
          ruleName: 'test-warning-2',
        }],
      };

      ruleRegistry.register(rule1);
      ruleRegistry.register(rule2);

      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const diagnostics = linter.lint(content);

      const warnings = diagnostics.filter(d => d.severity === 'warning');

      // The severity-only comparator is a stable sort, so equal-severity
      // diagnostics keep the order their rules were registered in.
      expect(warnings.map(d => d.message)).toEqual(['Warning 1', 'Warning 2']);
    });
  });
});
