/**
 * Semantic linter rules for Sprite3D
 *
 * Note: Format validation (billboard values, pixel_size, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., resource references exist, frame validation).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';

/**
 * Validate Sprite3D semantic rules (resource references, frame validation, etc.)
 */
function checkSprite3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // Check if texture resource exists (REQUIRED - Sprite3D is useless without texture)
  if (!rawProps.texture) {
    diagnostics.push({
      severity: 'warning',
      message: `Sprite3D requires a 'texture' property. Sprite3D is not visible without a texture.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'sprite3d-requires-texture',
    });
  } else {
    // Texture is specified - check if it exists
    const resourceExists = checkResourceExists(scene, rawProps.texture);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Texture resource not found: ${rawProps.texture}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-sprite3d-resources',
      });
    }
  }

  // `set_frame` opens with ERR_FAIL_INDEX (sprite_3d.cpp:878), and `hframes`
  // and `vframes` are declared ahead of `frame` (:1014-1016), so the guard sees
  // the authored grid and the out-of-range write is refused at load.
  if (rawProps.frame !== undefined) {
    const frame = parseInt(rawProps.frame, 10);
    const hframes = rawProps.hframes !== undefined ? parseInt(rawProps.hframes, 10) : 1;
    const vframes = rawProps.vframes !== undefined ? parseInt(rawProps.vframes, 10) : 1;

    if (!isNaN(frame) && !isNaN(hframes) && !isNaN(vframes)) {
      const maxFrame = hframes * vframes;
      if (frame >= maxFrame) {
        diagnostics.push({
          severity: 'error',
          message: `Frame ${frame} is out of range. Maximum frame is ${maxFrame - 1} (hframes=${hframes}, vframes=${vframes}). Godot refuses the assignment, so the sprite loads on frame 0.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'sprite3d-frame-range',
        });
      }
    }
  }

  // Validate region_rect requires region_enabled
  if (rawProps.region_rect !== undefined && rawProps.region_enabled === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `Property 'region_rect' is set but 'region_enabled' is not true. The region_rect will be ignored.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'sprite3d-region-configuration',
    });
  } else if (rawProps.region_rect !== undefined && rawProps.region_enabled !== undefined) {
    // Check if region_enabled is explicitly false
    const regionEnabled = rawProps.region_enabled.toLowerCase();
    if (regionEnabled === 'false' || regionEnabled === '0') {
      diagnostics.push({
        severity: 'warning',
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
    description: 'Validates Sprite3D texture resources, frame ranges, and region configuration',
    category: 'validation',
    applicableNodeTypes: ['Sprite3D'],
    emits: [
      {
        ruleName: 'sprite3d-requires-texture',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'sprite_3d.cpp:798',
          unused: 'the draw clears the base and returns, so the sprite renders nothing',
        },
      },
      {
        ruleName: 'valid-sprite3d-resources',
        severity: 'error',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the texture reference names a resource id this file never declares',
        },
      },
      {
        ruleName: 'sprite3d-frame-range',
        severity: 'error',
        grounding: { kind: 'engine', at: 'sprite_3d.cpp:878' },
      },
      {
        ruleName: 'sprite3d-region-configuration',
        severity: 'warning',
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
