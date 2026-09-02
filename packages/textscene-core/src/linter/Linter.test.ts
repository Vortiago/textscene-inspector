/**
 * Tests for Linter — the two-phase contract, and the end-to-end runs over a
 * whole scene.
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
    afterEach(() => {
      ruleRegistry['rules'].delete('test-rule');
      ruleRegistry['rules'].delete('test-combined-rule');
    });

    it('should run Phase 1 (strict parsing) first', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const diagnostics = linter.lint(content);

      // Valid content should produce no diagnostics
      expect(diagnostics).toHaveLength(0);
    });

    it('should detect parse errors in Phase 1', () => {
      // `[node type=…]` with no `name=`, not a typeless heading: a heading
      // stating none of type/index/instance is LEGAL (Godot assumes it was
      // instantiated, resource_format_text.cpp:218-221) and now warns.
      const content = `[gd_scene load_steps=1 format=3]

[node type="Node2D"]
`;

      const diagnostics = linter.lint(content);

      expect(diagnostics.length).toBeGreaterThan(0);
      const parseError = diagnostics.find(d => d.ruleName === 'strict-parser');
      expect(parseError).toBeDefined();
      expect(parseError!.severity).toBe('error');
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
    });

    it('should combine parse errors and rule violations when both exist', () => {
      // The strict parser returns a scene even for a heading it rejected, so a
      // parse error never suppresses the rule phase.
      const testRule: LintRule = {
        meta: {
          name: 'test-combined-rule',
          description: 'Test rule',
          category: 'validation',
        },
        check: (context) => [{
          severity: 'warning',
          message: 'Test warning',
          nodeName: context.node.name,
          nodeType: context.node.type,
          ruleName: 'test-combined-rule',
        }],
      };

      ruleRegistry.register(testRule);

      // A typeless heading 0: Godot assumes it was instantiated
      // (resource_format_text.cpp:218-221) and, with no base scene, refuses
      // the instantiate (packed_scene.cpp:220) — an error that still leaves
      // the scene to phase 2.
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const diagnostics = linter.lint(content);

      const parseError = diagnostics.find(d => d.ruleName === 'strict-parser');
      expect(parseError).toBeDefined();
      expect(parseError!.severity).toBe('error');

      const ruleViolation = diagnostics.find(d => d.ruleName === 'test-combined-rule');
      expect(ruleViolation).toBeDefined();
      expect(ruleViolation!.severity).toBe('warning');
      expect(ruleViolation!.nodeName).toBe('Root');
      // The typeless heading gave the node no type, and it still reached phase 2.
      expect(ruleViolation!.nodeType).toBe('');
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

      // Semantic rules run alongside parse errors rather than being suppressed
      // by the first one, so the set is not errors-only. The typeless `Root`
      // heading is an ERROR: Godot reads the absence as "assume this was
      // instantiated" (resource_format_text.cpp:218-221) and refuses a root
      // with no base scene (packed_scene.cpp:220).
      expect(diagnostics.filter((d) => d.severity === 'error').length).toBeGreaterThanOrEqual(3);
      expect(
        diagnostics.filter(
          (d) => d.severity === 'error' && d.message.includes('states no "type="')
        )
      ).toHaveLength(1);
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
