/** The registry lint rules add themselves to on import. */

import type { LintRule } from './types';
import * as logger from '../logger';

export class RuleRegistry {
  private rules: Map<string, LintRule> = new Map();
  /**
   * Memoised `getRulesForNodeType` results, keyed by node type: `Linter` asks for each node, and filtering every rule
   * each time costs O(nodes * rules). `register` and `clear` invalidate it. Rules register at module load, before
   * any lint, so no lint pays for that.
   */
  private rulesForNodeTypeCache: Map<string, LintRule[]> = new Map();

  /**
   * Register a lint rule.
   * @param rule - The rule to register
   */
  register(rule: LintRule): void {
    if (this.rules.has(rule.meta.name)) {
      logger.warn(`Rule "${rule.meta.name}" is already registered. Overwriting.`);
    }
    this.rules.set(rule.meta.name, rule);
    this.rulesForNodeTypeCache.clear();
  }

  /**
   * @returns Array of all registered rules
   */
  getRules(): LintRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * The rules for a node type, by exact match: a rule for 'Node3D' does not run for MeshInstance3D. ValidatorRegistry
   * walks the base-type chain because format validators inherit down the class hierarchy, while a semantic rule opts
   * into a family through its own `applicableNodeTypeMatcher` (see valid-node3d-visibility).
   *
   * @param nodeType - The node type to filter by
   * @returns The cached, frozen array itself, not a per-call copy, since this runs for each node in the lint hot path.
   */
  getRulesForNodeType(nodeType: string): readonly LintRule[] {
    const cached = this.rulesForNodeTypeCache.get(nodeType);
    if (cached) return cached;

    const matched = this.getRules().filter(rule => {
      const { applicableNodeTypes, applicableNodeTypeMatcher } = rule.meta;
      // A predicate matcher decides applicability on its own.
      if (applicableNodeTypeMatcher) {
        return applicableNodeTypeMatcher(nodeType);
      }
      // A rule with no applicableNodeTypes applies to every node.
      if (!applicableNodeTypes || applicableNodeTypes.length === 0) {
        return true;
      }
      return applicableNodeTypes.includes(nodeType);
    });
    Object.freeze(matched);
    this.rulesForNodeTypeCache.set(nodeType, matched);
    return matched;
  }

  /**
   * @param name - The rule name
   * @returns The rule, or undefined if not found
   */
  getRule(name: string): LintRule | undefined {
    return this.rules.get(name);
  }

  /** Clear every registered rule, for a test. */
  clear(): void {
    this.rules.clear();
    this.rulesForNodeTypeCache.clear();
  }
}

export const ruleRegistry = new RuleRegistry();
