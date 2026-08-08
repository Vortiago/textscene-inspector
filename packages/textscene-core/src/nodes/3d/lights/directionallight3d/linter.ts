/**
 * Semantic linter rules for DirectionalLight3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { rangeAdvisories } from '../../../../linter/rangeAdvisory.js';
import { lightEnergyArms } from '../shared/linterChecks.js';

/**
 * Validate DirectionalLight3D semantic rules
 */
function checkDirectionalLight3D(context: RuleContext): Diagnostic[] {
  const { node } = context;

  const diagnostics = rangeAdvisories(node, {
    light_energy: lightEnergyArms('directionallight3d'),
    directional_shadow_max_distance: [
      {
        // light_3d.cpp:584, PROPERTY_HINT_RANGE "0,8192,0.1,or_greater,exp": high end open, low end 0
        under: 0,
        ruleName: 'directionallight3d-negative-shadow-distance',
        cite: 'light_3d.cpp:584',
        message: (maxDistance) =>
          `Shadow max distance is negative (${maxDistance}). The editor range for directional_shadow_max_distance starts at 0.`,
      },
    ],
  });

  // The remaining check is cross-field consistency (shadow mode vs. which split
  // fields the inspector still shows), not a range advisory, so it stays
  // hand-written.
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  const split1 = rawProps.directional_shadow_split_1 ? parseFloat(rawProps.directional_shadow_split_1) : undefined;
  const split2 = rawProps.directional_shadow_split_2 ? parseFloat(rawProps.directional_shadow_split_2) : undefined;
  const split3 = rawProps.directional_shadow_split_3 ? parseFloat(rawProps.directional_shadow_split_3) : undefined;

  // Godot raises no warning for this — it just hides the field. Grounded in
  // `_validate_property` (light_3d.cpp:542-551): under `ORTHOGONAL`,
  // `directional_shadow_split_1`/`directional_shadow_blend_splits` get
  // `PROPERTY_USAGE_NO_EDITOR`; under `ORTHOGONAL` or `PARALLEL_2_SPLITS`,
  // `directional_shadow_split_2`/`directional_shadow_split_3` do too — the
  // inspector simply stops showing the now-inapplicable split fields.
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
    description: 'Validates DirectionalLight3D property values and shadow mode consistency',
    category: 'validation',
    applicableNodeTypes: ['DirectionalLight3D'],
    emits: [
      // via lightEnergyArms('directionallight3d')
      {
        ruleName: 'directionallight3d-negative-energy',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'light_3d.cpp:389' },
      },
      {
        ruleName: 'directionallight3d-negative-shadow-distance',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'light_3d.cpp:584' },
      },
      {
        ruleName: 'directionallight3d-unused-splits',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'renderer_scene_cull.cpp:2175',
          unused: 'the cascade loop reads only the first split offsets for the chosen mode',
        },
      },
    ],
  },
  check: checkDirectionalLight3D,
};

// Self-register the rule
ruleRegistry.register(directionalLight3DValidationRule);

// Export for testing
export { directionalLight3DValidationRule };
