/**
 * Registry for self-registering lint rules
 */

import type { LintRule } from './types';
import * as logger from '../logger';

export class RuleRegistry {
  private rules: Map<string, LintRule> = new Map();

  /**
   * Register a lint rule
   * @param rule - The rule to register
   */
  register(rule: LintRule): void {
    if (this.rules.has(rule.meta.name)) {
      logger.warn(`Rule "${rule.meta.name}" is already registered. Overwriting.`);
    }
    this.rules.set(rule.meta.name, rule);
  }

  /**
   * Get all registered rules
   * @returns Array of all registered rules
   */
  getRules(): LintRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rules applicable to a specific node type.
   *
   * Applicability is exact-match by design (a rule for 'Node3D' does NOT run for
   * MeshInstance3D) — unlike ValidatorRegistry, which walks the base-type chain.
   * The two registries intentionally differ: format validators inherit naturally
   * down the class hierarchy, whereas a semantic rule opts into a family via its
   * own `applicableNodeTypeMatcher` predicate (see valid-node3d-visibility).
   *
   * @param nodeType - The node type to filter by
   * @returns Array of rules applicable to the node type
   */
  getRulesForNodeType(nodeType: string): LintRule[] {
    return this.getRules().filter(rule => {
      const { applicableNodeTypes, applicableNodeTypeMatcher } = rule.meta;
      // A predicate matcher decides applicability on its own (takes precedence).
      if (applicableNodeTypeMatcher) {
        return applicableNodeTypeMatcher(nodeType);
      }
      // If no applicableNodeTypes specified, rule applies to all nodes
      if (!applicableNodeTypes || applicableNodeTypes.length === 0) {
        return true;
      }
      // Otherwise, check if this node type is in the applicable list
      return applicableNodeTypes.includes(nodeType);
    });
  }

  /**
   * Get a specific rule by name
   * @param name - The rule name
   * @returns The rule, or undefined if not found
   */
  getRule(name: string): LintRule | undefined {
    return this.rules.get(name);
  }

  /**
   * Clear all registered rules (useful for testing)
   */
  clear(): void {
    this.rules.clear();
  }
}

// Export singleton instance
export const ruleRegistry = new RuleRegistry();
