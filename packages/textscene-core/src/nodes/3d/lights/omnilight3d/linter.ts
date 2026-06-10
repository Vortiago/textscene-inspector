/**
 * Semantic linter rules for OmniLight3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { checkLightEnergy } from '../shared/linterChecks.js';

// Thresholds for warnings
const LARGE_OMNI_RANGE = 1000;
const SMALL_OMNI_RANGE = 0.1;
const EXTREME_OMNI_ATTENUATION_MIN = 0.1;
const EXTREME_OMNI_ATTENUATION_MAX = 5;

/**
 * Validate OmniLight3D semantic rules
 */
function checkOmniLight3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  // Only run for OmniLight3D nodes
  if (node.type !== 'OmniLight3D') {
    return diagnostics;
  }

  // Type guard for properties
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // ERROR: omni_range is missing (required for OmniLight3D to function)
  if (rawProps.omni_range === undefined) {
    diagnostics.push({
      severity: 'error',
      message: `OmniLight3D requires 'omni_range' property to function. This defines the light's radius.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'omnilight3d-missing-range',
    });
  }

  checkLightEnergy(rawProps, node.name, node.type, 'omnilight3d', diagnostics);

  // Warn if omni_range is very large (performance concern)
  if (rawProps.omni_range !== undefined) {
    const range = parseFloat(rawProps.omni_range);
    if (!isNaN(range)) {
      if (range > LARGE_OMNI_RANGE) {
        diagnostics.push({
          severity: 'warning',
          message: `Light range is very large (${range}). Values above ${LARGE_OMNI_RANGE} can impact performance significantly.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'omnilight3d-large-range',
        });
      } else if (range < SMALL_OMNI_RANGE) {
        diagnostics.push({
          severity: 'warning',
          message: `Light range is very small (${range}). Values below ${SMALL_OMNI_RANGE} might not be visible.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'omnilight3d-small-range',
        });
      }
    }
  }

  // Warn if omni_attenuation is extreme
  if (rawProps.omni_attenuation !== undefined) {
    const attenuation = parseFloat(rawProps.omni_attenuation);
    if (!isNaN(attenuation)) {
      if (attenuation < EXTREME_OMNI_ATTENUATION_MIN) {
        diagnostics.push({
          severity: 'warning',
          message: `Light attenuation is very low (${attenuation}). Values below ${EXTREME_OMNI_ATTENUATION_MIN} result in very slow falloff.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'omnilight3d-extreme-attenuation',
        });
      } else if (attenuation > EXTREME_OMNI_ATTENUATION_MAX) {
        diagnostics.push({
          severity: 'warning',
          message: `Light attenuation is very high (${attenuation}). Values above ${EXTREME_OMNI_ATTENUATION_MAX} can impact performance if range is also large.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'omnilight3d-extreme-attenuation',
        });
      }
    }
  }

  return diagnostics;
}

/**
 * OmniLight3D semantic validation rule
 */
const omniLight3DValidationRule: LintRule = {
  meta: {
    name: 'valid-omnilight3d-properties',
    description: 'Validates OmniLight3D property values, required properties, and performance considerations',
    category: 'validation',
    applicableNodeTypes: ['OmniLight3D'],
  },
  check: checkOmniLight3D,
};

// Self-register the rule
ruleRegistry.register(omniLight3DValidationRule);

// Export for testing
export { omniLight3DValidationRule };
