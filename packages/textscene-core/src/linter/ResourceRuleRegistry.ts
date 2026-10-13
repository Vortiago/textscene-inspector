/**
 * The registry resource rules add themselves to on import. A **Resource rule** checks one resource
 * section, a `[sub_resource]` or a `.tres` body, for a condition Godot reports when it loads that
 * resource, whatever holds it. A node-anchored `LintRule` misses a resource no node in the file
 * holds, and reports a shared one once per holder.
 */

import type { RuleArm } from './types.js';
import * as logger from '../logger';

/** One diagnostic a resource rule reports, on the line of the property it names. */
export interface ResourceFinding {
  readonly arm: RuleArm;
  readonly message: string;
  /** The property the finding is about, as the section's bag stores it. */
  readonly property: string;
}

export interface ResourceRuleMeta {
  /** Unique registry key, shared with `RuleRegistry`'s names. */
  readonly name: string;
  readonly description: string;
  /** The Godot class whose sections the rule checks, by exact match. */
  readonly resourceType: string;
  /** Every arm `check` reports through, as `RuleMeta.emits` holds a node rule's. */
  readonly emits: readonly RuleArm[];
}

export interface ResourceRule {
  readonly meta: ResourceRuleMeta;
  /** The findings for one section's raw property bag. */
  check(data: Readonly<Record<string, string>>): ResourceFinding[];
}

export class ResourceRuleRegistry {
  private rules = new Map<string, ResourceRule>();

  register(rule: ResourceRule): void {
    if (this.rules.has(rule.meta.name)) {
      logger.warn(`Resource rule "${rule.meta.name}" is already registered. Overwriting.`);
    }
    this.rules.set(rule.meta.name, rule);
  }

  getRules(): ResourceRule[] {
    return Array.from(this.rules.values());
  }

  getRulesForResourceType(resourceType: string): ResourceRule[] {
    return this.getRules().filter((rule) => rule.meta.resourceType === resourceType);
  }
}

export const resourceRuleRegistry = new ResourceRuleRegistry();
