/**
 * Semantic linter rules for SpotLight3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';

// Thresholds for warnings
const EXTREME_LIGHT_ENERGY_MIN = 0.01;
const EXTREME_LIGHT_ENERGY_MAX = 100;
const LARGE_SPOT_RANGE = 1000;
const SMALL_SPOT_RANGE = 0.1;
const EXTREME_SPOT_ATTENUATION_MIN = 0.1;
const EXTREME_SPOT_ATTENUATION_MAX = 5;
const EXTREME_SPOT_ANGLE_ATTENUATION_MIN = 0.1;
const EXTREME_SPOT_ANGLE_ATTENUATION_MAX = 5;
const SMALL_SPOT_ANGLE = 1;

/**
 * Check if properties object exists and is valid
 */
function isValidProperties(props: unknown): props is Record<string, string> {
  return typeof props === 'object' && props !== null;
}

/**
 * Validate SpotLight3D semantic rules
 */
function checkSpotLight3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  // Only run for SpotLight3D nodes
  if (node.type !== 'SpotLight3D') {
    return diagnostics;
  }

  // Type guard for properties
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // ERROR: spot_range is missing (required for SpotLight3D to function)
  if (rawProps.spot_range === undefined) {
    diagnostics.push({
      severity: 'error',
      message: `SpotLight3D requires 'spot_range' property to function. This defines the light's maximum distance.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'spotlight3d-missing-range',
    });
  }

  // ERROR: spot_angle is missing (required for SpotLight3D to function)
  if (rawProps.spot_angle === undefined) {
    diagnostics.push({
      severity: 'error',
      message: `SpotLight3D requires 'spot_angle' property to function. This defines the cone angle in degrees.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'spotlight3d-missing-angle',
    });
  }

  // Warn if light_energy is extreme
  if (rawProps.light_energy !== undefined) {
    const energy = parseFloat(rawProps.light_energy);
    if (!isNaN(energy)) {
      if (energy < EXTREME_LIGHT_ENERGY_MIN) {
        diagnostics.push({
          severity: 'warning',
          message: `Light energy is very low (${energy}). Values below ${EXTREME_LIGHT_ENERGY_MIN} may be barely visible.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'spotlight3d-extreme-energy',
        });
      } else if (energy > EXTREME_LIGHT_ENERGY_MAX) {
        diagnostics.push({
          severity: 'warning',
          message: `Light energy is very high (${energy}). Values above ${EXTREME_LIGHT_ENERGY_MAX} may cause overexposure.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'spotlight3d-extreme-energy',
        });
      }
    }
  }

  // Warn if spot_range is very large (performance concern)
  if (rawProps.spot_range !== undefined) {
    const range = parseFloat(rawProps.spot_range);
    if (!isNaN(range)) {
      if (range > LARGE_SPOT_RANGE) {
        diagnostics.push({
          severity: 'warning',
          message: `Light range is very large (${range}). Values above ${LARGE_SPOT_RANGE} can impact performance significantly.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'spotlight3d-large-range',
        });
      } else if (range < SMALL_SPOT_RANGE) {
        diagnostics.push({
          severity: 'warning',
          message: `Light range is very small (${range}). Values below ${SMALL_SPOT_RANGE} might not be visible.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'spotlight3d-small-range',
        });
      }
    }
  }

  // Warn if spot_attenuation is extreme
  if (rawProps.spot_attenuation !== undefined) {
    const attenuation = parseFloat(rawProps.spot_attenuation);
    if (!isNaN(attenuation)) {
      if (attenuation < EXTREME_SPOT_ATTENUATION_MIN) {
        diagnostics.push({
          severity: 'warning',
          message: `Light attenuation is very low (${attenuation}). Values below ${EXTREME_SPOT_ATTENUATION_MIN} result in very slow falloff.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'spotlight3d-extreme-attenuation',
        });
      } else if (attenuation > EXTREME_SPOT_ATTENUATION_MAX) {
        diagnostics.push({
          severity: 'warning',
          message: `Light attenuation is very high (${attenuation}). Values above ${EXTREME_SPOT_ATTENUATION_MAX} result in very fast falloff.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'spotlight3d-extreme-attenuation',
        });
      }
    }
  }

  // Warn if spot_angle_attenuation is extreme
  if (rawProps.spot_angle_attenuation !== undefined) {
    const angleAttenuation = parseFloat(rawProps.spot_angle_attenuation);
    if (!isNaN(angleAttenuation)) {
      if (angleAttenuation < EXTREME_SPOT_ANGLE_ATTENUATION_MIN) {
        diagnostics.push({
          severity: 'warning',
          message: `Angular attenuation is very low (${angleAttenuation}). Values below ${EXTREME_SPOT_ANGLE_ATTENUATION_MIN} result in very soft edges.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'spotlight3d-extreme-angle-attenuation',
        });
      } else if (angleAttenuation > EXTREME_SPOT_ANGLE_ATTENUATION_MAX) {
        diagnostics.push({
          severity: 'warning',
          message: `Angular attenuation is very high (${angleAttenuation}). Values above ${EXTREME_SPOT_ANGLE_ATTENUATION_MAX} result in very sharp edges.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'spotlight3d-extreme-angle-attenuation',
        });
      }
    }
  }

  // Warn if spot_angle is very small
  if (rawProps.spot_angle !== undefined) {
    const angle = parseFloat(rawProps.spot_angle);
    if (!isNaN(angle)) {
      if (angle < SMALL_SPOT_ANGLE && angle > 0) {
        diagnostics.push({
          severity: 'warning',
          message: `Spot angle is very small (${angle} degrees). Values below ${SMALL_SPOT_ANGLE} degree might not be visible.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'spotlight3d-small-angle',
        });
      }
    }
  }

  return diagnostics;
}

/**
 * SpotLight3D semantic validation rule
 */
const spotLight3DValidationRule: LintRule = {
  meta: {
    name: 'valid-spotlight3d-properties',
    description: 'Validates SpotLight3D property values, required properties, and performance considerations',
    category: 'validation',
    applicableNodeTypes: ['SpotLight3D'],
  },
  check: checkSpotLight3D,
};

// Self-register the rule
ruleRegistry.register(spotLight3DValidationRule);

// Export for testing
export { spotLight3DValidationRule };
