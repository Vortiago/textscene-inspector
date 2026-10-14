import { describe, expect, it } from 'vitest';
import { ResourceRuleRegistry, type ResourceRule } from './ResourceRuleRegistry';
import { warningsOf } from '../r3f/testing/logWarnings';

function rule(name: string, resourceType: string): ResourceRule {
  return { meta: { name, description: '', resourceType, emits: [] }, check: () => [] };
}

describe('ResourceRuleRegistry', () => {
  it('returns the rules for a resource type, by exact match', () => {
    const registry = new ResourceRuleRegistry();
    const sky = rule('a', 'Sky');
    registry.register(sky);
    registry.register(rule('b', 'Environment'));
    expect(registry.getRulesForResourceType('Sky')).toEqual([sky]);
  });

  it('returns no rules for a type none checks (edge case)', () => {
    expect(new ResourceRuleRegistry().getRulesForResourceType('Sky')).toEqual([]);
  });

  it('warns and keeps the later rule when a name registers twice (error case)', () => {
    const registry = new ResourceRuleRegistry();
    const later = rule('a', 'Environment');
    const warnings = warningsOf(() => {
      registry.register(rule('a', 'Sky'));
      registry.register(later);
    });
    expect(warnings.join('')).toContain('"a" is already registered');
    expect(registry.getRules()).toEqual([later]);
  });
});
