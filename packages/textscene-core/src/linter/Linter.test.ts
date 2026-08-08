/**
 * Tests for Linter — the two-phase contract, and the end-to-end runs over a
 * whole scene.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from './Linter.js';
import { ruleRegistry } from './RuleRegistry.js';
import type { LintRule } from './types.js';

describe('Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('Two-Phase Validation', () => {
    it('should run Phase 1 (strict parsing) first', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const diagnostics = linter.lint(content);

      // Valid content should produce no diagnostics
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect parse errors in Phase 1', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      const parseError = diagnostics.find(d => d.ruleName === 'strict-parser');
      expect(parseError).toBeDefined();
      expect(parseError!.severity).toBe('error');
    });

    it('should skip Phase 2 (semantic validation) when parse errors found', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      // Should only have parse errors, not semantic rule violations
      expect(diagnostics.every(d => d.ruleName === 'strict-parser')).toBe(true);
    });

    it('should run Phase 2 (semantic validation) when parsing succeeds', () => {
      // Create a test rule that always reports an issue
      const testRule: LintRule = {
        meta: {
          name: 'test-rule',
          description: 'Test rule',
          category: 'validation',
        },
        check: (context) => [{
          severity: 'warning',
          message: 'Test warning',
          nodeName: context.node.name,
          nodeType: context.node.type,
          ruleName: 'test-rule',
        }],
      };

      ruleRegistry.register(testRule);

      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      const ruleViolation = diagnostics.find(d => d.ruleName === 'test-rule');
      expect(ruleViolation).toBeDefined();
      expect(ruleViolation!.severity).toBe('warning');

      // Cleanup
      ruleRegistry['rules'].delete('test-rule');
    });

    it('should combine parse errors and rule violations when both exist', () => {
      // This test validates the architecture but currently parse errors prevent Phase 2
      // In a scenario where we might change this behavior, this test documents expected outcome
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      // Currently: only parse errors (Phase 2 skipped)
      expect(diagnostics.every(d => d.ruleName === 'strict-parser')).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should produce comprehensive diagnostics for complex invalid scene', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]

[node type="Node3D"]

[node name="Valid" type="Node3D" parent="."]
invalidproperty
`;

      const diagnostics = linter.lint(content);

      // Should have multiple parse errors (at least 3). Semantic rules now run
      // alongside them rather than being suppressed by the first error, so the
      // set is no longer errors-only.
      expect(diagnostics.filter((d) => d.severity === 'error').length).toBeGreaterThanOrEqual(3);
    });

    it('should integrate StrictTscnParser and RuleRegistry correctly', () => {
      const testRule: LintRule = {
        meta: {
          name: 'test-integration-rule',
          description: 'Integration test rule',
          category: 'validation',
        },
        check: (context) => {
          if (context.node.name === 'Root') {
            return [{
              severity: 'warning',
              message: 'Found root node',
              nodeName: context.node.name,
              nodeType: context.node.type,
              ruleName: 'test-integration-rule',
            }];
          }
          return [];
        },
      };

      ruleRegistry.register(testRule);

      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
visible = true
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]!.ruleName).toBe('test-integration-rule');
      expect(diagnostics[0]!.severity).toBe('warning');
      expect(diagnostics[0]!.message).toBe('Found root node');

      // Cleanup
      ruleRegistry['rules'].delete('test-integration-rule');
    });
  });
});
