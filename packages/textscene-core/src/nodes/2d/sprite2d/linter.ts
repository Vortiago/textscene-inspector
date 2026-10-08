/**
 * Sprite2D semantic rules: the ones that need the whole node, such as the
 * texture, the frame grid and the region pair. linterParser.ts checks formats.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { heldResource } from '../../../linter/resourceChecker.js';
import { boolSlotValue } from '../../../godot/index.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../../linter/ruleArms.js';
import { spriteFrameArms, spriteFrameDiagnostics } from '../../../linter/spriteFrameGrid.js';

const arms = {
  requiresTexture: groundedArm('sprite2d-requires-texture', {
    kind: 'engine-inert',
    at: 'sprite_2d.cpp:159',
    unused: 'the draw returns immediately, so the sprite renders nothing',
  }),
  ...spriteFrameArms('sprite2d', {
    frame: 'sprite_2d.cpp:296',
    frameCoords: 'sprite_2d.cpp:312',
    remap: 'sprite_2d.cpp:358',
  }),
  regionConfiguration: groundedArm('sprite2d-region-configuration', {
    kind: 'engine-inert',
    at: 'sprite_2d.cpp:98',
    unused: 'region_rect is read only inside this branch; the else uses the texture size',
  }),
} as const satisfies RuleArms<string>;

/** Checks the Sprite2D semantic rules. */
function checkSprite2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  const rawProps = node.rawProperties;

  if (heldResource(rawProps.texture) === undefined) {
    reportArm(
      diagnostics,
      arms.requiresTexture,
      node,
      `Sprite2D requires a 'texture' property. Sprite2D is not visible without a texture.`
    );
  }

  // Frame writes, judged in file order against the grid Godot holds at each
  // line, with a later `hframes` re-mapping a frame that landed (spriteFrameGrid.ts).
  diagnostics.push(...spriteFrameDiagnostics(node, rawProps, arms));

  // Godot raises no warning for this. Grounded in `_get_rects()`
  // (sprite_2d.cpp:96-105): `region_rect` is read into `base_rect` only
  // inside the `if (region_enabled)` branch, so it is unconditionally
  // ignored whenever `region_enabled` is false or absent (its own default).
  if (rawProps.region_rect !== undefined && rawProps.region_enabled === undefined) {
    reportArm(
      diagnostics,
      arms.regionConfiguration,
      node,
      `Property 'region_rect' is set but 'region_enabled' is not true. The region_rect will be ignored.`
    );
  } else if (rawProps.region_rect !== undefined && rawProps.region_enabled !== undefined) {
    // Not lowercased: `VariantParser` compares the identifier case-sensitively
    // (`id == "false"`, variant_parser.cpp:695-697), so `region_enabled = FALSE`
    // fails Godot's load and is no boolean.
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

/**
 * Sprite2D semantic validation rule
 */
const sprite2DValidationRule: LintRule = {
  meta: {
    name: 'valid-sprite2d-resources',
    description: 'Validates Sprite2D texture presence, frame ranges, and region configuration',
    category: 'validation',
    applicableNodeTypes: ['Sprite2D'],
    emits: armEmits(arms),
  },
  check: checkSprite2D,
};

// Self-register the rule
ruleRegistry.register(sprite2DValidationRule);

// Export for testing
export { sprite2DValidationRule };
