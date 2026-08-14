/**
 * Semantic linter rules for DirectionalLight3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { parseGodotInt } from '../../../../linter/validators/commonValidators.js';

/**
 * Validate DirectionalLight3D semantic rules
 *
 * No range advisory here: `directional_shadow_max_distance`'s and
 * `light_energy`'s hint floors are validator bounds (light_3d.cpp:584, :389).
 * What remains is cross-field consistency (shadow mode vs. which split fields
 * the inspector still shows).
 */
function checkDirectionalLight3D(context: RuleContext): Diagnostic[] {
  const { node } = context;

  const diagnostics: Diagnostic[] = [];

  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // Presence, not value: the rule asks which splits the file authors, and the
  // numbers themselves are never compared.
  const split1 = Boolean(rawProps.directional_shadow_split_1);
  const split2 = Boolean(rawProps.directional_shadow_split_2);
  const split3 = Boolean(rawProps.directional_shadow_split_3);

  // Godot raises no warning for this — it just hides the field. Grounded in
  // `_validate_property` (light_3d.cpp:542-551): under `ORTHOGONAL`,
  // `directional_shadow_split_1`/`directional_shadow_blend_splits` get
  // `PROPERTY_USAGE_NO_EDITOR`; under `ORTHOGONAL` or `PARALLEL_2_SPLITS`,
  // `directional_shadow_split_2`/`directional_shadow_split_3` do too — the
  // inspector simply stops showing the now-inapplicable split fields.
  // `parseGodotInt('')` is already null, so an absent key needs no third state.
  const shadowMode = parseGodotInt(rawProps.directional_shadow_mode ?? '');

  if (shadowMode !== null && !Number.isNaN(shadowMode)) {
    // ORTHOGONAL mode (0) doesn't use splits
    if (shadowMode === 0) {
      if (split1 || split2 || split3) {
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
      if (split2 || split3) {
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
