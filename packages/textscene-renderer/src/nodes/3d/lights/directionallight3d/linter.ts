/**
 * Semantic linter rules for DirectionalLight3D
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
const LARGE_SHADOW_MAX_DISTANCE = 10000;

/**
 * Check if properties object exists and is valid
 */
function isValidProperties(props: unknown): props is Record<string, string> {
  return typeof props === 'object' && props !== null;
}

/**
 * Validate DirectionalLight3D semantic rules
 */
function checkDirectionalLight3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  // Only run for DirectionalLight3D nodes
  if (node.type !== 'DirectionalLight3D') {
    return diagnostics;
  }

  // Type guard for properties
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

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
          ruleName: 'directionallight3d-extreme-energy',
        });
      } else if (energy > EXTREME_LIGHT_ENERGY_MAX) {
        diagnostics.push({
          severity: 'warning',
          message: `Light energy is very high (${energy}). Values above ${EXTREME_LIGHT_ENERGY_MAX} may cause overexposure.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'directionallight3d-extreme-energy',
        });
      }
    }
  }

  // Validate shadow split ordering (split_1 < split_2 < split_3)
  const split1 = rawProps.directional_shadow_split_1 ? parseFloat(rawProps.directional_shadow_split_1) : undefined;
  const split2 = rawProps.directional_shadow_split_2 ? parseFloat(rawProps.directional_shadow_split_2) : undefined;
  const split3 = rawProps.directional_shadow_split_3 ? parseFloat(rawProps.directional_shadow_split_3) : undefined;

  if (split1 !== undefined && split2 !== undefined && !isNaN(split1) && !isNaN(split2)) {
    if (split1 >= split2) {
      diagnostics.push({
        severity: 'error',
        message: `Shadow split ordering invalid: split_1 (${split1}) must be less than split_2 (${split2})`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'directionallight3d-shadow-split-order',
      });
    }
  }

  if (split2 !== undefined && split3 !== undefined && !isNaN(split2) && !isNaN(split3)) {
    if (split2 >= split3) {
      diagnostics.push({
        severity: 'error',
        message: `Shadow split ordering invalid: split_2 (${split2}) must be less than split_3 (${split3})`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'directionallight3d-shadow-split-order',
      });
    }
  }

  if (split1 !== undefined && split3 !== undefined && !isNaN(split1) && !isNaN(split3)) {
    if (split1 >= split3) {
      diagnostics.push({
        severity: 'error',
        message: `Shadow split ordering invalid: split_1 (${split1}) must be less than split_3 (${split3})`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'directionallight3d-shadow-split-order',
      });
    }
  }

  // Warn if shadow_max_distance is very large (performance concern)
  if (rawProps.directional_shadow_max_distance !== undefined) {
    const maxDistance = parseFloat(rawProps.directional_shadow_max_distance);
    if (!isNaN(maxDistance) && maxDistance > LARGE_SHADOW_MAX_DISTANCE) {
      diagnostics.push({
        severity: 'warning',
        message: `Shadow max distance is very large (${maxDistance}). Values above ${LARGE_SHADOW_MAX_DISTANCE} can impact performance significantly.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'directionallight3d-large-shadow-distance',
      });
    }
  }

  // Validate shadow_mode consistency with splits
  const shadowMode = rawProps.directional_shadow_mode ? parseInt(rawProps.directional_shadow_mode, 10) : undefined;

  if (shadowMode !== undefined && !isNaN(shadowMode)) {
    // ORTHOGONAL mode (0) doesn't use splits
    if (shadowMode === 0) {
      if (split1 !== undefined || split2 !== undefined || split3 !== undefined) {
        diagnostics.push({
          severity: 'warning',
          message: `Shadow mode is ORTHOGONAL (0), but split properties are set. Splits are ignored in ORTHOGONAL mode.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'directionallight3d-unused-splits',
        });
      }
    }

    // PARALLEL_2_SPLITS mode (1) only uses split_1
    if (shadowMode === 1) {
      if (split2 !== undefined || split3 !== undefined) {
        diagnostics.push({
          severity: 'warning',
          message: `Shadow mode is PARALLEL_2_SPLITS (1), but split_2 or split_3 are set. Only split_1 is used in 2-split mode.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'directionallight3d-unused-splits',
        });
      }
    }

    // PARALLEL_4_SPLITS mode (2) uses all splits
    // No warnings needed for this mode
  }

  return diagnostics;
}

/**
 * DirectionalLight3D semantic validation rule
 */
const directionalLight3DValidationRule: LintRule = {
  meta: {
    name: 'valid-directionallight3d-properties',
    description: 'Validates DirectionalLight3D property values, shadow split ordering, and mode consistency',
    category: 'validation',
    applicableNodeTypes: ['DirectionalLight3D'],
  },
  check: checkDirectionalLight3D,
};

// Self-register the rule
ruleRegistry.register(directionalLight3DValidationRule);

// Export for testing
export { directionalLight3DValidationRule };
