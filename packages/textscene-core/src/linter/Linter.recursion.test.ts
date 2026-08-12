/**
 * Linter: phase 2 reaches every node in the tree, not just the roots.
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
  });
});
