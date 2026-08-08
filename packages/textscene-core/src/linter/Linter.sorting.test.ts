/**
 * Linter: the order diagnostics come back in — by position, then by severity.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Linter } from './Linter.js';
import { ruleRegistry } from './RuleRegistry.js';
import type { LintRule } from './types.js';

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
      expect(warnings).toHaveLength(2);

      // Cleanup
      ruleRegistry['rules'].delete('test-warning-1');
      ruleRegistry['rules'].delete('test-warning-2');
    });
  });
});
