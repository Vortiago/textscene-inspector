/**
 * Linter: empty input, a scene with no nodes, a rule that reports several
 * diagnostics at once.
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

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const content = '';

      const diagnostics = linter.lint(content);

      expect(diagnostics).toHaveLength(0);
    });

    it('should handle content with only comments', () => {
      const content = `; Just comments
; Nothing to lint
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics).toHaveLength(0);
    });

    it('should handle scene with no nodes', () => {
      const content = `[gd_scene load_steps=1 format=3]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics).toHaveLength(0);
    });

    it('should handle scene with only resources (no nodes)', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://icon.png" id="1"]

[sub_resource type="BoxMesh" id="1"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics).toHaveLength(0);
    });

    it('should handle rules that return empty diagnostic arrays', () => {
      const testRule: LintRule = {
        meta: {
          name: 'test-empty-rule',
          description: 'Returns no diagnostics',
          category: 'validation',
        },
        check: () => [],
      };

      ruleRegistry.register(testRule);

      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics).toHaveLength(0);

      // Cleanup
      ruleRegistry['rules'].delete('test-empty-rule');
    });

    it('should handle rules that return multiple diagnostics', () => {
      const testRule: LintRule = {
        meta: {
          name: 'test-multi-diagnostic-rule',
          description: 'Returns multiple diagnostics',
          category: 'validation',
        },
        check: (context) => [
          {
            severity: 'error',
            message: 'Error 1',
            nodeName: context.node.name,
            nodeType: context.node.type,
            ruleName: 'test-multi-diagnostic-rule',
          },
          {
            severity: 'warning',
            message: 'Warning 1',
            nodeName: context.node.name,
            nodeType: context.node.type,
            ruleName: 'test-multi-diagnostic-rule',
          },
        ],
      };

      ruleRegistry.register(testRule);

      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const diagnostics = linter.lint(content);

      const ruleDiagnostics = diagnostics.filter(d => d.ruleName === 'test-multi-diagnostic-rule');
      expect(ruleDiagnostics).toHaveLength(2);

      // Cleanup
      ruleRegistry['rules'].delete('test-multi-diagnostic-rule');
    });
  });
});
