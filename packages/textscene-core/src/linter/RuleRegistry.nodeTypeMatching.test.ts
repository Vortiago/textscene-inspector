/**
 * Which rules `getRulesForNodeType` hands back.
 *
 * Three selection shapes share one method: universal (no `applicableNodeTypes`,
 * or an empty one), an exact-name list, and a predicate that takes precedence
 * over the list. The store itself is the sibling `RuleRegistry.test.ts`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RuleRegistry } from './RuleRegistry.js';
import type { LintRule } from './types.js';

describe('RuleRegistry', () => {
  let registry: RuleRegistry;

  beforeEach(() => {
    registry = new RuleRegistry();
  });

  const createMockRule = (name: string, applicableNodeTypes?: string[]): LintRule => ({
    meta: {
      name,
      description: `Test rule: ${name}`,
      category: 'validation',
      applicableNodeTypes,
    },
    check: () => [],
  });

  describe('getRulesForNodeType', () => {
    it('should return universal rules (no applicableNodeTypes)', () => {
      const universalRule = createMockRule('universal-rule', undefined);
      const specificRule = createMockRule('specific-rule', ['MeshInstance3D']);

      registry.register(universalRule);
      registry.register(specificRule);

      const rules = registry.getRulesForNodeType('Node3D');
      expect(rules).toContain(universalRule);
      expect(rules).not.toContain(specificRule);
    });

    it('should return universal rules (empty applicableNodeTypes)', () => {
      const universalRule = createMockRule('universal-rule', []);
      const specificRule = createMockRule('specific-rule', ['MeshInstance3D']);

      registry.register(universalRule);
      registry.register(specificRule);

      const rules = registry.getRulesForNodeType('DirectionalLight3D');
      expect(rules).toContain(universalRule);
      expect(rules).not.toContain(specificRule);
    });

    it('should return rules for specific node type', () => {
      const meshRule = createMockRule('mesh-rule', ['MeshInstance3D']);
      const lightRule = createMockRule('light-rule', ['DirectionalLight3D']);

      registry.register(meshRule);
      registry.register(lightRule);

      const meshRules = registry.getRulesForNodeType('MeshInstance3D');
      expect(meshRules).toContain(meshRule);
      expect(meshRules).not.toContain(lightRule);

      const lightRules = registry.getRulesForNodeType('DirectionalLight3D');
      expect(lightRules).toContain(lightRule);
      expect(lightRules).not.toContain(meshRule);
    });

    it('should return rule applicable to multiple node types', () => {
      const multiNodeRule = createMockRule('multi-node-rule', [
        'MeshInstance3D',
        'DirectionalLight3D',
        'Camera3D',
      ]);

      registry.register(multiNodeRule);

      expect(registry.getRulesForNodeType('MeshInstance3D')).toContain(multiNodeRule);
      expect(registry.getRulesForNodeType('DirectionalLight3D')).toContain(multiNodeRule);
      expect(registry.getRulesForNodeType('Camera3D')).toContain(multiNodeRule);
      expect(registry.getRulesForNodeType('Node3D')).not.toContain(multiNodeRule);
    });

    it('should combine universal and specific rules', () => {
      const universalRule = createMockRule('universal-rule', []);
      const meshRule = createMockRule('mesh-rule', ['MeshInstance3D']);
      const lightRule = createMockRule('light-rule', ['DirectionalLight3D']);

      registry.register(universalRule);
      registry.register(meshRule);
      registry.register(lightRule);

      const meshRules = registry.getRulesForNodeType('MeshInstance3D');
      expect(meshRules).toHaveLength(2);
      expect(meshRules).toContain(universalRule);
      expect(meshRules).toContain(meshRule);

      const lightRules = registry.getRulesForNodeType('DirectionalLight3D');
      expect(lightRules).toHaveLength(2);
      expect(lightRules).toContain(universalRule);
      expect(lightRules).toContain(lightRule);

      const node3dRules = registry.getRulesForNodeType('Node3D');
      expect(node3dRules).toHaveLength(1);
      expect(node3dRules).toContain(universalRule);
    });

    it('should return empty array for node type with no applicable rules', () => {
      const meshRule = createMockRule('mesh-rule', ['MeshInstance3D']);
      registry.register(meshRule);

      expect(registry.getRulesForNodeType('DirectionalLight3D')).toEqual([]);
    });
  });

  describe('getRulesForNodeType with applicableNodeTypeMatcher', () => {
    const matcherRule = (name: string, matcher: (t: string) => boolean): LintRule => ({
      meta: {
        name,
        description: `Test rule: ${name}`,
        category: 'validation',
        applicableNodeTypeMatcher: matcher,
      },
      check: () => [],
    });

    it('applies a matcher-based rule to every type the predicate accepts', () => {
      const rule = matcherRule('spatial-rule', (t) => t === 'Node3D' || t.endsWith('3D'));
      registry.register(rule);

      expect(registry.getRulesForNodeType('Node3D')).toContain(rule);
      expect(registry.getRulesForNodeType('MeshInstance3D')).toContain(rule);
      expect(registry.getRulesForNodeType('Camera3D')).toContain(rule);
      expect(registry.getRulesForNodeType('Sprite2D')).not.toContain(rule);
      expect(registry.getRulesForNodeType('Label')).not.toContain(rule);
    });

    it('lets the matcher take precedence over applicableNodeTypes', () => {
      const rule: LintRule = {
        meta: {
          name: 'matcher-wins',
          description: 'x',
          category: 'validation',
          applicableNodeTypes: ['Node3D'],
          applicableNodeTypeMatcher: (t) => t.endsWith('3D'),
        },
        check: () => [],
      };
      registry.register(rule);

      expect(registry.getRulesForNodeType('MeshInstance3D')).toContain(rule);
    });

    it('leaves exact-match (matcher-less) rules unchanged', () => {
      const rule = createMockRule('exact', ['MeshInstance3D']);
      registry.register(rule);

      expect(registry.getRulesForNodeType('MeshInstance3D')).toContain(rule);
      expect(registry.getRulesForNodeType('Camera3D')).not.toContain(rule);
    });
  });
});
