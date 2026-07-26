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

  // Only run for Sprite3D nodes
  if (node.type !== 'Sprite3D') {
    return diagnostics;
  }

  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // Check if texture resource exists (REQUIRED - Sprite3D is useless without texture)
  if (!rawProps.texture) {
    diagnostics.push({
      severity: 'error',
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

  // Validate frame is within valid range (frame < hframes * vframes)
  if (rawProps.frame !== undefined) {
    const frame = parseInt(rawProps.frame, 10);
    const hframes = rawProps.hframes !== undefined ? parseInt(rawProps.hframes, 10) : 1;
    const vframes = rawProps.vframes !== undefined ? parseInt(rawProps.vframes, 10) : 1;

    if (!isNaN(frame) && !isNaN(hframes) && !isNaN(vframes)) {
      const maxFrame = hframes * vframes;
      if (frame >= maxFrame) {
        diagnostics.push({
          severity: 'warning',
          message: `Frame ${frame} is out of range. Maximum frame is ${maxFrame - 1} (hframes=${hframes}, vframes=${vframes})`,
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

  // Validate axis property is only used with FIXED_Y billboard mode
  if (rawProps.axis !== undefined && rawProps.billboard !== undefined) {
    const billboard = parseInt(rawProps.billboard, 10);
    if (!isNaN(billboard) && billboard !== 2) {
      diagnostics.push({
        severity: 'warning',
        message: `Property 'axis' is only used when billboard mode is FIXED_Y (2). Current billboard mode is ${billboard}.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'sprite3d-axis-usage',
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
      { ruleName: 'sprite3d-requires-texture', severity: 'error' },
      { ruleName: 'valid-sprite3d-resources', severity: 'error' },
      { ruleName: 'sprite3d-frame-range', severity: 'warning' },
      { ruleName: 'sprite3d-region-configuration', severity: 'warning' },
      { ruleName: 'sprite3d-axis-usage', severity: 'warning' },
    ],
  },
  check: checkSprite3D,
};

// Self-register the rule
ruleRegistry.register(sprite3DValidationRule);

// Export for testing
export { sprite3DValidationRule };
