/**
 * Semantic linter rules for Sprite2D
 *
 * Note: Format validation (texture references, Vector2, Rect2, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., resource references exist, frame validation).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { heldResource } from '../../../linter/resourceChecker.js';
import { boolSlotValue } from '../../../godot/index.js';
import { spriteFrameDiagnostics } from '../../../linter/spriteFrameGrid.js';

/**
 * Validate Sprite2D semantic rules (resource references, frame validation, etc.)
 */
function checkSprite2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  if (heldResource(rawProps.texture) === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `Sprite2D requires a 'texture' property. Sprite2D is not visible without a texture.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'sprite2d-requires-texture',
    });
  }

  // Frame writes, judged in file order against the grid Godot holds at each
  // line, with a later `hframes` re-mapping a frame that landed (spriteFrameGrid.ts).
  diagnostics.push(...spriteFrameDiagnostics(node, rawProps, 'sprite2d'));

  // Godot raises no warning for this. Grounded in `_get_rects()`
  // (sprite_2d.cpp:96-105): `region_rect` is read into `base_rect` only
  // inside the `if (region_enabled)` branch, so it is unconditionally
  // ignored whenever `region_enabled` is false or absent (its own default).
  if (rawProps.region_rect !== undefined && rawProps.region_enabled === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `Property 'region_rect' is set but 'region_enabled' is not true. The region_rect will be ignored.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'sprite2d-region-configuration',
    });
  } else if (rawProps.region_rect !== undefined && rawProps.region_enabled !== undefined) {
    // Handed to the shared reader unnormalised: `VariantParser` compares the
    // identifier case-SENSITIVELY (`id == "false"`, variant_parser.cpp:695-697),
    // so lowercasing first made `region_enabled = FALSE` — a value Godot fails
    // the load on — read as a boolean the file does not carry.
    if (boolSlotValue(rawProps.region_enabled) === false) {
      diagnostics.push({
        severity: 'warning',
        message: `Property 'region_rect' is set but 'region_enabled' is false. The region_rect will be ignored.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'sprite2d-region-configuration',
      });
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
    emits: [
      {
        ruleName: 'sprite2d-requires-texture',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'sprite_2d.cpp:159',
          unused: 'the draw returns immediately, so the sprite renders nothing',
        },
      },
      {
        ruleName: 'sprite2d-frame-range',
        severity: 'error',
        grounding: { kind: 'engine', at: 'sprite_2d.cpp:296' },
      },
      {
        ruleName: 'sprite2d-frame-coords-range',
        severity: 'error',
        grounding: { kind: 'engine', at: 'sprite_2d.cpp:312' },
      },
      {
        ruleName: 'sprite2d-frame-remapped',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'sprite_2d.cpp:358' },
      },
      {
        ruleName: 'sprite2d-region-configuration',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'sprite_2d.cpp:98',
          unused: 'region_rect is read only inside this branch; the else uses the texture size',
        },
      },
    ],
  },
  check: checkSprite2D,
};

// Self-register the rule
ruleRegistry.register(sprite2DValidationRule);

// Export for testing
export { sprite2DValidationRule };
