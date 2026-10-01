/**
 * Semantic linter rules for Decal: referenced textures resolve, and three of Decal's own
 * `get_configuration_warnings()` checks (decal.cpp:184-193). linterParser.ts validates format.
 * The renderer-method check at decal.cpp:179 (`gl_compatibility`/`dummy`) is runtime-only and not
 * modelled, as `decal-requires-texture` ignores its early return in that branch (decal.cpp:180).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { resourceSlotIsEmpty } from '../../../linter/resourceChecker.js';
import { ruleInt } from '../../../linter/validators/commonValidators.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../../linter/ruleArms.js';

const arms = {
  requiresTexture: groundedArm('decal-requires-texture', { kind: 'configuration-warning' }),
  normalOrmWithoutAlbedo: groundedArm('decal-normal-orm-without-albedo', { kind: 'configuration-warning' }),
  emptyCullMask: groundedArm('decal-empty-cull-mask', { kind: 'configuration-warning' }),
} as const satisfies RuleArms<string>;

const TEXTURE_PROPS = ['texture_albedo', 'texture_normal', 'texture_orm', 'texture_emission'] as const;

function checkDecal(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  const rawProps = node.properties as unknown as Record<string, string>;

  // A decal with no texture at all projects nothing: valid in Godot, but almost certainly a
  // mistake, so a warning.
  if (TEXTURE_PROPS.every((prop) => resourceSlotIsEmpty(rawProps[prop]))) {
    reportArm(
      diagnostics,
      arms.requiresTexture,
      node,
      "Decal has no texture (e.g. 'texture_albedo'). It will project nothing and is not visible."
    );
  }

  // decal.cpp:188: a Normal/ORM map blends onto the Albedo texture's alpha
  // channel, so it does nothing without one.
  if (
    (!resourceSlotIsEmpty(rawProps.texture_normal) || !resourceSlotIsEmpty(rawProps.texture_orm)) &&
    resourceSlotIsEmpty(rawProps.texture_albedo)
  ) {
    reportArm(
      diagnostics,
      arms.normalOrmWithoutAlbedo,
      node,
      'Decal has a Normal and/or ORM texture, but no Albedo texture. An Albedo texture with an alpha channel is required to blend the normal/ORM maps onto the underlying surface.'
    );
  }

  // decal.cpp:191-192. Default cull_mask is (1 << 20) - 1 (decal.h:54), so an
  // absent key never trips this, only an explicit 0. The setter takes uint32_t
  // (decal.h:106), which is the width the validator declares too.
  if (rawProps.cull_mask !== undefined && ruleInt(rawProps.cull_mask, null, 'uint32') === 0) {
    reportArm(
      diagnostics,
      arms.emptyCullMask,
      node,
      "Decal's Cull Mask has no bits enabled, so the decal will not paint objects on any layer. Enable at least one bit in the Cull Mask property."
    );
  }

  return diagnostics;
}

const decalValidationRule: LintRule = {
  meta: {
    name: 'valid-decal-resources',
    description:
      "Three of Decal's get_configuration_warnings checks: at least one texture, Normal/ORM without Albedo, and an empty Cull Mask",
    category: 'validation',
    emits: armEmits(arms),
    applicableNodeTypes: ['Decal'],
  },
  check: checkDecal,
};

ruleRegistry.register(decalValidationRule);

export { decalValidationRule };
