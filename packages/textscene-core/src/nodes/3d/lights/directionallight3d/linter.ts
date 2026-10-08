/**
 * DirectionalLight3D semantic rules. linterParser.ts validates the format.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../../../linter/ruleArms.js';

const arms = {
  unusedSplits: groundedArm('directionallight3d-unused-splits', {
    kind: 'engine-inert',
    at: 'renderer_scene_cull.cpp:2175',
    unused: 'the cascade loop reads only the first split offsets for the chosen mode',
  }),
} as const satisfies RuleArms<string>;

/**
 * Shadow mode against the split fields the inspector still shows. The hint
 * floors of `directional_shadow_max_distance` and `light_energy` are validator
 * bounds (light_3d.cpp:584, :389), so no range advisory is here.
 */
function checkDirectionalLight3D(context: RuleContext): Diagnostic[] {
  const { node } = context;

  const diagnostics: Diagnostic[] = [];

  const rawProps = node.rawProperties;

  // Presence, not value: the rule asks which splits the file authors, and the
  // numbers themselves are never compared.
  const split1 = Boolean(rawProps.directional_shadow_split_1);
  const split2 = Boolean(rawProps.directional_shadow_split_2);
  const split3 = Boolean(rawProps.directional_shadow_split_3);

  // Godot raises no warning, it hides the field: `_validate_property`
  // (light_3d.cpp:542-551) gives split_1 and blend_splits `PROPERTY_USAGE_NO_EDITOR`
  // under ORTHOGONAL, and split_2 and split_3 under ORTHOGONAL or PARALLEL_2_SPLITS.
  // `ruleInt('')` is null, so an absent key needs no third state.
  const shadowMode = ruleInt(rawProps.directional_shadow_mode ?? '');

  if (shadowMode !== null) {
    // ORTHOGONAL (0) uses no splits.
    if (shadowMode === 0) {
      if (split1 || split2 || split3) {
        reportArm(
          diagnostics,
          arms.unusedSplits,
          node,
          `Shadow mode is ORTHOGONAL (0), but split properties are set. Splits are ignored in ORTHOGONAL mode.`
        );
      }
    }

    // PARALLEL_2_SPLITS (1) uses only split_1.
    if (shadowMode === 1) {
      if (split2 || split3) {
        reportArm(
          diagnostics,
          arms.unusedSplits,
          node,
          `Shadow mode is PARALLEL_2_SPLITS (1), but split_2 or split_3 are set. Only split_1 is used in 2-split mode.`
        );
      }
    }
  }

  return diagnostics;
}

const directionalLight3DValidationRule: LintRule = {
  meta: {
    name: 'valid-directionallight3d-properties',
    description: 'Validates DirectionalLight3D property values and shadow mode consistency',
    category: 'validation',
    applicableNodeTypes: ['DirectionalLight3D'],
    emits: armEmits(arms),
  },
  check: checkDirectionalLight3D,
};

ruleRegistry.register(directionalLight3DValidationRule);

export { directionalLight3DValidationRule };
