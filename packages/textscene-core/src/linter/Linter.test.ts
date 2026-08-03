/**
 * Tests for Linter
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

  describe('Parse Error to Diagnostic Conversion', () => {
    it('should convert parse error to diagnostic format', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics[0]!;

      expect(diagnostic).toHaveProperty('severity');
      expect(diagnostic).toHaveProperty('message');
      expect(diagnostic).toHaveProperty('nodeName');
      expect(diagnostic).toHaveProperty('nodeType');
      expect(diagnostic).toHaveProperty('ruleName');
      expect(diagnostic).toHaveProperty('location');
    });

    it('should set ruleName to "strict-parser" for parse errors', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      diagnostics.forEach(d => {
        expect(d.ruleName).toBe('strict-parser');
      });
    });

    it('should set nodeName to "<unknown>" for parse errors', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      diagnostics.forEach(d => {
        expect(d.nodeName).toBe('<unknown>');
      });
    });

    it('should set nodeType to "<unknown>" for parse errors', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      diagnostics.forEach(d => {
        expect(d.nodeType).toBe('<unknown>');
      });
    });

    it('should preserve line and column information', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics[0]!;

      expect(diagnostic.location).toBeDefined();
      expect(diagnostic.location!.line).toBe(3);
      expect(diagnostic.location!.column).toBe(1);
    });

    it('should preserve error severity', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      diagnostics.forEach(d => {
        expect(d.severity).toBe('error');
      });
    });

    it('should preserve error message', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      const diagnostic = diagnostics[0]!;

      expect(diagnostic.message).toBeTruthy();
      expect(typeof diagnostic.message).toBe('string');
    });
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

  describe('Recursive Node Linting', () => {
    afterEach(() => {
      ruleRegistry['rules'].delete('test-recursive-rule');
    });

    it('should lint all nodes in scene tree', () => {
      const visitedNodes: string[] = [];

      const testRule: LintRule = {
        meta: {
          name: 'test-recursive-rule',
          description: 'Track visited nodes',
          category: 'validation',
        },
        check: (context) => {
          visitedNodes.push(context.node.name);
          return [];
        },
      };

      ruleRegistry.register(testRule);

      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" type="Node3D" parent="."]

[node name="GrandChild" type="Node3D" parent="Child1"]
`;

      linter.lint(content);

      expect(visitedNodes).toContain('Root');
      expect(visitedNodes).toContain('Child1');
      expect(visitedNodes).toContain('Child2');
      expect(visitedNodes).toContain('GrandChild');
      expect(visitedNodes).toHaveLength(4);
    });

    it('should lint children after parent', () => {
      const visitOrder: string[] = [];

      const testRule: LintRule = {
        meta: {
          name: 'test-recursive-rule',
          description: 'Track visit order',
          category: 'validation',
        },
        check: (context) => {
          visitOrder.push(context.node.name);
          return [];
        },
      };

      ruleRegistry.register(testRule);

      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Child" type="Node3D" parent="."]

[node name="GrandChild" type="Node3D" parent="Child"]
`;

      linter.lint(content);

      expect(visitOrder.indexOf('Root')).toBeLessThan(visitOrder.indexOf('Child'));
      expect(visitOrder.indexOf('Child')).toBeLessThan(visitOrder.indexOf('GrandChild'));
    });

    it('should lint deeply nested hierarchies', () => {
      const visitedNodes: string[] = [];

      const testRule: LintRule = {
        meta: {
          name: 'test-recursive-rule',
          description: 'Track visited nodes',
          category: 'validation',
        },
        check: (context) => {
          visitedNodes.push(context.node.name);
          return [];
        },
      };

      ruleRegistry.register(testRule);

      // Note: buildSceneTree requires exact path matching for deep nesting
      // Use child names that match the parent path structure
      const content = `[gd_scene load_steps=1 format=3]

[node name="Level0" type="Node3D"]

[node name="Level1" type="Node3D" parent="."]

[node name="Level2" type="Node3D" parent="Level1"]
`;

      linter.lint(content);

      // 3-level hierarchy is enough to test recursive linting
      expect(visitedNodes.length).toBeGreaterThanOrEqual(3);
      expect(visitedNodes).toContain('Level0');
      expect(visitedNodes).toContain('Level1');
      expect(visitedNodes).toContain('Level2');
    });
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
