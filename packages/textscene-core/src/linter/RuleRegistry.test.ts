/**
 * Tests for RuleRegistry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RuleRegistry } from './RuleRegistry.js';
import type { LintRule } from './types.js';
import * as logger from '../logger.js';

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

  describe('register', () => {
    it('should register a rule', () => {
      const rule = createMockRule('test-rule');
      registry.register(rule);

      expect(registry.getRule('test-rule')).toBe(rule);
    });

    it('should warn when registering duplicate rule', () => {
      const loggerWarn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      const rule1 = createMockRule('duplicate-rule');
      const rule2 = createMockRule('duplicate-rule');

      registry.register(rule1);
      registry.register(rule2);

      expect(loggerWarn).toHaveBeenCalledWith(
        'Rule "duplicate-rule" is already registered. Overwriting.'
      );
      expect(registry.getRule('duplicate-rule')).toBe(rule2);

      loggerWarn.mockRestore();
    });

    it('should register multiple rules', () => {
      const rule1 = createMockRule('rule-1');
      const rule2 = createMockRule('rule-2');
      const rule3 = createMockRule('rule-3');

      registry.register(rule1);
      registry.register(rule2);
      registry.register(rule3);

      expect(registry.getRules()).toHaveLength(3);
      expect(registry.getRule('rule-1')).toBe(rule1);
      expect(registry.getRule('rule-2')).toBe(rule2);
      expect(registry.getRule('rule-3')).toBe(rule3);
    });
  });

  describe('getRules', () => {
    it('should return empty array when no rules registered', () => {
      expect(registry.getRules()).toEqual([]);
    });

    it('should return all registered rules', () => {
      const rule1 = createMockRule('rule-1');
      const rule2 = createMockRule('rule-2');

      registry.register(rule1);
      registry.register(rule2);

      const rules = registry.getRules();
      expect(rules).toHaveLength(2);
      expect(rules).toContain(rule1);
      expect(rules).toContain(rule2);
    });
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

  describe('getRule', () => {
    it('should get rule by name', () => {
      const rule = createMockRule('test-rule');
      registry.register(rule);

      expect(registry.getRule('test-rule')).toBe(rule);
    });

    it('should return undefined for non-existent rule', () => {
      expect(registry.getRule('nonexistent')).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all registered rules', () => {
      const rule1 = createMockRule('rule-1');
      const rule2 = createMockRule('rule-2');

      registry.register(rule1);
      registry.register(rule2);

      expect(registry.getRules()).toHaveLength(2);

      registry.clear();

      expect(registry.getRules()).toEqual([]);
      expect(registry.getRule('rule-1')).toBeUndefined();
      expect(registry.getRule('rule-2')).toBeUndefined();
    });

    it('should allow re-registration after clear', () => {
      const rule1 = createMockRule('rule-1');
      const rule2 = createMockRule('rule-2');

      registry.register(rule1);
      registry.clear();
      registry.register(rule2);

      expect(registry.getRules()).toHaveLength(1);
      expect(registry.getRule('rule-1')).toBeUndefined();
      expect(registry.getRule('rule-2')).toBe(rule2);
    });
  });

  describe('rule execution', () => {
    it('should execute rule check function', () => {
      const mockCheck = vi.fn(() => [
        {
          severity: 'error' as const,
          message: 'Test error',
          nodeName: 'TestNode',
          nodeType: 'MeshInstance3D',
          ruleName: 'test-rule',
        },
      ]);

      const rule: LintRule = {
        meta: {
          name: 'test-rule',
          description: 'Test rule',
          category: 'validation',
          applicableNodeTypes: ['MeshInstance3D'],
        },
        check: mockCheck,
      };

      registry.register(rule);

      const foundRule = registry.getRule('test-rule');
      expect(foundRule).toBe(rule);

      const context = {
        scene: { nodes: [], externalResources: [], internalResources: [] },
        node: { name: 'TestNode', type: 'MeshInstance3D', properties: {}, children: [] },
        properties: {},
      };

      const diagnostics = foundRule!.check(context);
      expect(mockCheck).toHaveBeenCalledWith(context);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.message).toBe('Test error');
    });

    it('should execute rule and return empty array for valid node', () => {
      const rule: LintRule = {
        meta: {
          name: 'test-rule',
          description: 'Test rule',
          category: 'validation',
        },
        check: () => [], // No diagnostics
      };

      registry.register(rule);

      const context = {
        scene: { nodes: [], externalResources: [], internalResources: [] },
        node: { name: 'ValidNode', type: 'Node3D', properties: {}, children: [] },
        properties: {},
      };

      const diagnostics = rule.check(context);
      expect(diagnostics).toEqual([]);
    });
  });
});
