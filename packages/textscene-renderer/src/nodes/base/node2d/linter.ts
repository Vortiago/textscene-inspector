/**
 * Semantic linter rules for Node2D
 *
 * Note: Format validation (Vector2, Transform2D, boolean formats, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';

/**
 * Node2D properties interface for type checking
 */
interface Node2DProperties {
  name: string;
  parent?: string;
  position?: unknown;
  rotation?: number;
  rotation_degrees?: number;
  scale?: unknown;
  skew?: number;
  transform?: unknown;
  global_position?: unknown;
  global_rotation?: number;
  global_rotation_degrees?: number;
  global_scale?: unknown;
  global_skew?: number;
  global_transform?: unknown;
  z_index?: number;
  z_as_relative?: boolean;
  y_sort_enabled?: boolean;
}

/**
 * Check if properties contain Node2D properties
 */
function hasNode2DProperties(props: unknown): props is Node2DProperties {
  return typeof props === 'object' && props !== null;
}

/**
 * Validate Node2D semantic rules
 * Currently no semantic rules beyond format validation
 */
function checkNode2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  // Only run for Node2D nodes and its subclasses
  if (node.type !== 'Node2D' && !node.type.endsWith('2D')) {
    return diagnostics;
  }

  // Type guard for properties
  if (!hasNode2DProperties(node.properties)) {
    return diagnostics;
  }

  // Future semantic validations can be added here
  // For example: checking if referenced nodes exist, validating property combinations, etc.

  return diagnostics;
}

/**
 * Node2D semantic validation rule
 */
const node2DValidationRule: LintRule = {
  meta: {
    name: 'valid-node2d',
    description: 'Validates Node2D semantic rules and property relationships',
    category: 'validation',
    applicableNodeTypes: ['Node2D'],
  },
  check: checkNode2D,
};

// Self-register the rule
ruleRegistry.register(node2DValidationRule);

// Export for testing
export { node2DValidationRule };
