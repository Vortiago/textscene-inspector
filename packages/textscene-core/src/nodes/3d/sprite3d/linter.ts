/**
 * Semantic linter rules for Sprite3D: the checks that need scene context, such as resource
 * references and frame writes. linterParser.ts handles format validation during strict parsing.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { heldResource } from '../../../linter/resourceChecker.js';
import { boolSlotValue } from '../../../godot/index.js';
import { armEmits, reportArm, type RuleArms } from '../../../linter/ruleArms.js';
import { spriteFrameArms, spriteFrameDiagnostics } from '../../../linter/spriteFrameGrid.js';

const arms = {
  requiresTexture: {
    severity: 'info',
    ruleName: 'sprite3d-requires-texture',
    grounding: {
      kind: 'engine-inert',
      at: 'sprite_3d.cpp:798',
      unused: 'the draw clears the base and returns, so the sprite renders nothing',
    },
  },
  ...spriteFrameArms('sprite3d', {
    frame: 'sprite_3d.cpp:878',
    frameCoords: 'sprite_3d.cpp:894',
    remap: 'sprite_3d.cpp:938',
  }),
  regionConfiguration: {
    severity: 'info',
    ruleName: 'sprite3d-region-configuration',
    grounding: {
      kind: 'engine-inert',
      at: 'sprite_3d.cpp:808',
      unused: 'region_rect is read only inside this branch',
    },
  },
} as const satisfies RuleArms<
  'requiresTexture' | 'frameRange' | 'frameCoordsRange' | 'frameRemapped' | 'regionConfiguration'
>;

function checkSprite3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  const rawProps = node.properties as unknown as Record<string, string>;

  if (heldResource(rawProps.texture) === undefined) {
    reportArm(
      diagnostics,
      arms.requiresTexture,
      node,
      `Sprite3D requires a 'texture' property. Sprite3D is not visible without a texture.`
    );
  }

  // Frame writes, judged in file order against the grid Godot holds at each
  // line, with a later `hframes` re-mapping a frame that landed (spriteFrameGrid.ts).
  diagnostics.push(...spriteFrameDiagnostics(node, rawProps, arms));

  // Validate region_rect requires region_enabled
  if (rawProps.region_rect !== undefined && rawProps.region_enabled === undefined) {
    reportArm(
      diagnostics,
      arms.regionConfiguration,
      node,
      `Property 'region_rect' is set but 'region_enabled' is not true. The region_rect will be ignored.`
    );
  } else if (rawProps.region_rect !== undefined && rawProps.region_enabled !== undefined) {
    // Handed to the shared reader unnormalised: `VariantParser` compares the identifier
    // case-sensitively (`id == "false"`, variant_parser.cpp:695-697), so `region_enabled = FALSE`,
    // a value Godot fails the load on, is not read as a boolean.
    if (boolSlotValue(rawProps.region_enabled) === false) {
      reportArm(
        diagnostics,
        arms.regionConfiguration,
        node,
        `Property 'region_rect' is set but 'region_enabled' is false. The region_rect will be ignored.`
      );
    }
  }

  return diagnostics;
}

const sprite3DValidationRule: LintRule = {
  meta: {
    name: 'valid-sprite3d-resources',
    description: 'Validates Sprite3D texture presence, frame ranges, and region configuration',
    category: 'validation',
    applicableNodeTypes: ['Sprite3D'],
    emits: armEmits(arms),
  },
  check: checkSprite3D,
};

ruleRegistry.register(sprite3DValidationRule);

export { sprite3DValidationRule };
