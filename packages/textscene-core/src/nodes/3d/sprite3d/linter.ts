/**
 * Semantic linter rules for Sprite3D
 *
 * Note: Format validation (billboard values, pixel_size, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., resource references exist, frame validation).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { heldResource } from '../../../linter/resourceChecker.js';
import { boolSlotValue } from '../../../godot/index.js';
import { spriteFrameDiagnostics } from '../../../linter/spriteFrameGrid.js';

/**
 * Validate Sprite3D semantic rules (resource references, frame validation, etc.)
 */
function checkSprite3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  if (heldResource(rawProps.texture) === undefined) {
    diagnostics.push({
      severity: 'info',
      message: `Sprite3D requires a 'texture' property. Sprite3D is not visible without a texture.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'sprite3d-requires-texture',
    });
  }

  // Frame writes, judged in file order against the grid Godot holds at each
  // line, with a later `hframes` re-mapping a frame that landed (spriteFrameGrid.ts).
  diagnostics.push(...spriteFrameDiagnostics(node, rawProps, 'sprite3d'));

  // Validate region_rect requires region_enabled
  if (rawProps.region_rect !== undefined && rawProps.region_enabled === undefined) {
    diagnostics.push({
      severity: 'info',
      message: `Property 'region_rect' is set but 'region_enabled' is not true. The region_rect will be ignored.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'sprite3d-region-configuration',
    });
  } else if (rawProps.region_rect !== undefined && rawProps.region_enabled !== undefined) {
    // Handed to the shared reader unnormalised: `VariantParser` compares the
    // identifier case-SENSITIVELY (`id == "false"`, variant_parser.cpp:695-697),
    // so lowercasing first made `region_enabled = FALSE` — a value Godot fails
    // the load on — read as a boolean the file does not carry.
    if (boolSlotValue(rawProps.region_enabled) === false) {
      diagnostics.push({
        severity: 'info',
        message: `Property 'region_rect' is set but 'region_enabled' is false. The region_rect will be ignored.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'sprite3d-region-configuration',
      });
    }
  }

  return diagnostics;
}

/**
 * Sprite3D semantic validation rule
 */
const sprite3DValidationRule: LintRule = {
  meta: {
    name: 'valid-sprite3d-resources',
    description: 'Validates Sprite3D texture presence, frame ranges, and region configuration',
    category: 'validation',
    applicableNodeTypes: ['Sprite3D'],
    emits: [
      {
        ruleName: 'sprite3d-requires-texture',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'sprite_3d.cpp:798',
          unused: 'the draw clears the base and returns, so the sprite renders nothing',
        },
      },
      {
        ruleName: 'sprite3d-frame-range',
        severity: 'error',
        grounding: { kind: 'engine', at: 'sprite_3d.cpp:878' },
      },
      {
        ruleName: 'sprite3d-frame-coords-range',
        severity: 'error',
        grounding: { kind: 'engine', at: 'sprite_3d.cpp:894' },
      },
      {
        ruleName: 'sprite3d-frame-remapped',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'sprite_3d.cpp:938' },
      },
      {
        ruleName: 'sprite3d-region-configuration',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'sprite_3d.cpp:808',
          unused: 'region_rect is read only inside this branch',
        },
      },
    ],
  },
  check: checkSprite3D,
};

// Self-register the rule
ruleRegistry.register(sprite3DValidationRule);

// Export for testing
export { sprite3DValidationRule };
