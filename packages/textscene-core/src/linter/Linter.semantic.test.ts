/**
 * Linter: phase 2, running the registered rules over the parsed scene.
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

  describe('Semantic Validation (Phase 2)', () => {
    afterEach(() => {
      // Cleanup test rules
      ruleRegistry['rules'].delete('test-semantic-rule');
      ruleRegistry['rules'].delete('test-type-specific-rule');
    });

    it('should apply rules from RuleRegistry', () => {
      const testRule: LintRule = {
        meta: {
          name: 'test-semantic-rule',
          description: 'Test semantic rule',
          category: 'validation',
        },
        check: (context) => [{
          severity: 'error',
          message: 'Test semantic error',
          nodeName: context.node.name,
          nodeType: context.node.type,
          ruleName: 'test-semantic-rule',
        }],
      };

      ruleRegistry.register(testRule);

      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      const ruleDiagnostic = diagnostics.find(d => d.ruleName === 'test-semantic-rule');
      expect(ruleDiagnostic).toBeDefined();
      expect(ruleDiagnostic!.message).toBe('Test semantic error');
    });

    it('should pass correct context to rules', () => {
      let capturedContext: any = null;

      const testRule: LintRule = {
        meta: {
          name: 'test-semantic-rule',
          description: 'Test context capture',
          category: 'validation',
        },
        check: (context) => {
          capturedContext = context;
          return [];
        },
      };

      ruleRegistry.register(testRule);

      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
visible = true
`;

      linter.lint(content);

      expect(capturedContext).not.toBeNull();
      expect(capturedContext.node).toBeDefined();
      expect(capturedContext.node.name).toBe('Root');
      expect(capturedContext.node.type).toBe('Node3D');
      expect(capturedContext.scene).toBeDefined();
      expect(capturedContext.properties).toBeDefined();
      expect(capturedContext.properties).toHaveProperty('visible');
    });

    it('should apply type-specific rules only to matching nodes', () => {
      const testRule: LintRule = {
        meta: {
          name: 'test-type-specific-rule',
          description: 'Test type-specific rule',
          category: 'validation',
          applicableNodeTypes: ['MeshInstance3D'],
        },
        check: (context) => [{
          severity: 'warning',
          message: 'MeshInstance3D specific warning',
          nodeName: context.node.name,
          nodeType: context.node.type,
          ruleName: 'test-type-specific-rule',
        }],
      };

      ruleRegistry.register(testRule);

      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Mesh" type="MeshInstance3D" parent="."]

[node name="Camera" type="Camera3D" parent="."]
`;

      const diagnostics = linter.lint(content);

      const meshWarnings = diagnostics.filter(d => d.ruleName === 'test-type-specific-rule');
      expect(meshWarnings).toHaveLength(1);
      expect(meshWarnings[0]!.nodeName).toBe('Mesh');
    });

    it('should collect diagnostics from multiple rules', () => {
      const rule1: LintRule = {
        meta: {
          name: 'test-rule-1',
          description: 'Test rule 1',
          category: 'validation',
        },
        check: () => [{
          severity: 'error',
          message: 'Error from rule 1',
          nodeName: 'Root',
          nodeType: 'Node3D',
          ruleName: 'test-rule-1',
        }],
      };

      const rule2: LintRule = {
        meta: {
          name: 'test-rule-2',
          description: 'Test rule 2',
          category: 'validation',
        },
        check: () => [{
          severity: 'warning',
          message: 'Warning from rule 2',
          nodeName: 'Root',
          nodeType: 'Node3D',
          ruleName: 'test-rule-2',
        }],
      };

      ruleRegistry.register(rule1);
      ruleRegistry.register(rule2);

      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.find(d => d.ruleName === 'test-rule-1')).toBeDefined();
      expect(diagnostics.find(d => d.ruleName === 'test-rule-2')).toBeDefined();

      // Cleanup
      ruleRegistry['rules'].delete('test-rule-1');
      ruleRegistry['rules'].delete('test-rule-2');
    });
  });
});
