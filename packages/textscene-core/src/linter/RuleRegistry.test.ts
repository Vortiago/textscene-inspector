/**
 * Tests for the rule registry: the store, registering and reading back. Each test reads a fresh
 * evaluation of the module, so its registry starts empty. Which rules a node type selects is the
 * sibling `RuleRegistry.nodeTypeMatching.test.ts`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ruleRegistry } from './RuleRegistry.js';
import type { LintRule } from './types.js';

describe('RuleRegistry', () => {
  let registry: typeof ruleRegistry;
  /** The logger the fresh registry warns through. */
  let logger: typeof import('../logger.js');

  beforeEach(async () => {
    vi.resetModules();
    registry = (await import('./RuleRegistry.js')).ruleRegistry;
    logger = await import('../logger.js');
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

      expect(loggerWarn).toHaveBeenCalledWith('Rule "duplicate-rule" is already registered. Overwriting.');
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
});
