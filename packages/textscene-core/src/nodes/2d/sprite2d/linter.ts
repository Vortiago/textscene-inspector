/**
 * Semantic linter rules for Sprite2D
 *
 * Note: Format validation (texture references, Vector2, Rect2, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., resource references exist, frame validation).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists, heldResource } from '../../../linter/resourceChecker.js';
import { ruleInt } from '../../../linter/validators/commonValidators.js';
import { matchVector2i } from '../../../linter/validators/vectorValidators.js';
import { boolSlotValue } from '../../../godot/index.js';

/**
 * The grid count Godot ACTUALLY holds, or `null` for a literal no rule can use.
 *
 * An absent key is Godot's default of 1. So is any value below it: `set_hframes`
 * and `set_vframes` both open with `ERR_FAIL_COND_MSG(p_amount < 1)`
 * (sprite_2d.cpp:323, :344), so the write is refused and the default stands. Reading
 * the authored 0 instead gave a grid of zero frames and reported every frame
 * index — index 0 included — as out of range of a maximum of -1.
 *
 * The authored value is not lost: `linterParser.ts` reports the refused write
 * itself, which is where that diagnostic belongs.
 */
function gridCount(raw: string | undefined): number | null {
  const count = ruleInt(raw, 1);
  return count === null ? null : Math.max(1, count);
}

/**
 * Validate Sprite2D semantic rules (resource references, frame validation, etc.)
 */
function checkSprite2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // Check if texture resource exists (REQUIRED - Sprite2D is useless without texture)
  const texture = heldResource(rawProps.texture);
  if (texture === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `Sprite2D requires a 'texture' property. Sprite2D is not visible without a texture.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'sprite2d-requires-texture',
    });
  } else {
    // Texture is specified - check if it exists
    const resourceExists = checkResourceExists(scene, texture);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Texture resource not found: ${rawProps.texture}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-sprite2d-resources',
      });
    }
  }

  // `set_frame` opens with ERR_FAIL_INDEX (sprite_2d.cpp:296), and `hframes`
  // and `vframes` are declared ahead of `frame` (:543-545), so the guard sees
  // the authored grid and the out-of-range write is refused at load, not at
  // some later runtime call.
  if (rawProps.frame !== undefined) {
    const frame = ruleInt(rawProps.frame);
    const hframes = gridCount(rawProps.hframes);
    const vframes = gridCount(rawProps.vframes);

    if (frame !== null && hframes !== null && vframes !== null) {
      const maxFrame = hframes * vframes;
      if (frame >= maxFrame) {
        diagnostics.push({
          severity: 'error',
          message: `Frame ${frame} is out of range. Maximum frame is ${maxFrame - 1} (hframes=${hframes}, vframes=${vframes}). Godot refuses the assignment, so the sprite loads on frame 0.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'sprite2d-frame-range',
        });
      }
    }
  }

  // Validate frame_coords is within valid grid range
  if (rawProps.frame_coords !== undefined) {
    // `null` for a component no int32 holds: linterParser.ts reports that, and
    // the narrowed value is not a coordinate to name.
    const coords = matchVector2i(rawProps.frame_coords);
    if (coords) {
      const { x: coordX, y: coordY } = coords;
      const hframes = gridCount(rawProps.hframes);
      const vframes = gridCount(rawProps.vframes);

      if (hframes !== null && vframes !== null) {
        if (coordX >= hframes) {
          diagnostics.push({
            severity: 'error',
            message: `frame_coords.x (${coordX}) is out of range. Maximum is ${hframes - 1} (hframes=${hframes}). Godot refuses the assignment, so the sprite loads on frame 0.`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: 'sprite2d-frame-coords-range',
          });
        }
        if (coordY >= vframes) {
          diagnostics.push({
            severity: 'error',
            message: `frame_coords.y (${coordY}) is out of range. Maximum is ${vframes - 1} (vframes=${vframes}). Godot refuses the assignment, so the sprite loads on frame 0.`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: 'sprite2d-frame-coords-range',
          });
        }
      }
    }
  }

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
    // Check if region_enabled is explicitly false
    const regionEnabled = rawProps.region_enabled.toLowerCase();
    if (boolSlotValue(regionEnabled) === false) {
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
    description: 'Validates Sprite2D texture resources, frame ranges, and region configuration',
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
        ruleName: 'valid-sprite2d-resources',
        severity: 'error',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the texture reference names a resource id this file never declares',
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
