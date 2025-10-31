/**
 * Registry for self-registering lint rules
 */

import type { LintRule } from './types';

export class RuleRegistry {
  private rules: Map<string, LintRule> = new Map();

  /**
   * Register a lint rule
   * @param rule - The rule to register
   */
  register(rule: LintRule): void {
    if (this.rules.has(rule.meta.name)) {
      console.warn(`Rule "${rule.meta.name}" is already registered. Overwriting.`);
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
   * Get rules applicable to a specific node type
   * @param nodeType - The node type to filter by
   * @returns Array of rules applicable to the node type
   */
  getRulesForNodeType(nodeType: string): LintRule[] {
    return this.getRules().filter(rule => {
      // If no applicableNodeTypes specified, rule applies to all nodes
      if (!rule.meta.applicableNodeTypes || rule.meta.applicableNodeTypes.length === 0) {
        return true;
      }
      // Otherwise, check if this node type is in the applicable list
      return rule.meta.applicableNodeTypes.includes(nodeType);
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
