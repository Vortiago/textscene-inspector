import { describe, expect, it, vi } from 'vitest';
import type { ResourceRule } from './ResourceRuleRegistry';

/**
 * An empty registry from a fresh evaluation of its module, and the warning capture of the logger
 * that evaluation warns through.
 */
async function freshRegistry() {
  vi.resetModules();
  const { resourceRuleRegistry } = await import('./ResourceRuleRegistry');
  const { warningsOf } = await import('../r3f/testing/logWarnings');
  return { registry: resourceRuleRegistry, warningsOf };
}

function rule(name: string, resourceType: string): ResourceRule {
  return { meta: { name, description: '', resourceType, emits: [] }, check: () => [] };
}

describe('ResourceRuleRegistry', () => {
  it('returns the rules for a resource type, by exact match', async () => {
    const { registry } = await freshRegistry();
    const sky = rule('a', 'Sky');
    registry.register(sky);
    registry.register(rule('b', 'Environment'));
    expect(registry.getRulesForResourceType('Sky')).toEqual([sky]);
  });

  it('returns no rules for a type none checks (edge case)', async () => {
    const { registry } = await freshRegistry();
    expect(registry.getRulesForResourceType('Sky')).toEqual([]);
  });

  it('warns and keeps the later rule when a name registers twice (error case)', async () => {
    const { registry, warningsOf } = await freshRegistry();
    const later = rule('a', 'Environment');
    const warnings = warningsOf(() => {
      registry.register(rule('a', 'Sky'));
      registry.register(later);
    });
    expect(warnings.join('')).toContain('"a" is already registered');
    expect(registry.getRules()).toEqual([later]);
  });
});
