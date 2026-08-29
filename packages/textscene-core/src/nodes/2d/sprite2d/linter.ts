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

/** The grid a write is judged against, and whether the file states a bigger one below it. */
interface AppliedGrid {
  hframes: number;
  vframes: number;
  /** An `hframes`/`vframes` line sits BELOW the key, so its value is not in effect yet. */
  late: boolean;
}

/**
 * The grid Godot holds at the moment it replays `key`, or `null` for a literal
 * no rule can use.
 *
 * `SceneState::instantiate` walks a node's stored properties in the order the
 * FILE lists them (packed_scene.cpp:369-492, over the list
 * resource_format_text.cpp:304 appends to as it scans), so an `hframes` line
 * below `frame` is still at its default of 1 when `set_frame`'s ERR_FAIL_INDEX
 * runs. sprite_2d.cpp:543-545 is the order Godot SAVES in, which binds nothing
 * a hand-authored body has to follow. Measured on 4.6.3: a body of `frame = 3`
 * then `hframes = 4` raises the ERR_FAIL_INDEX and loads on frame 0.
 *
 * Only the keys ABOVE `key` are read, so an unusable literal below it stops
 * nothing: its own diagnostic is `linterParser.ts`'s.
 */
function gridWhenApplied(rawProps: Record<string, string>, key: string): AppliedGrid | null {
  const grid: AppliedGrid = { hframes: 1, vframes: 1, late: false };
  let seenKey = false;
  for (const [written, raw] of Object.entries(rawProps)) {
    if (written === key) {
      seenKey = true;
      continue;
    }
    const axis = written === 'hframes' ? 'hframes' : written === 'vframes' ? 'vframes' : null;
    if (axis === null) continue;
    if (seenKey) {
      grid.late = true;
      continue;
    }
    const count = gridCount(raw);
    if (count === null) return null;
    grid[axis] = count;
  }
  return grid;
}

/** Why the grid a write was judged against is smaller than the one the file ends up with. */
function lateGridHint(key: string): string {
  return ` Godot applies properties in file order, so an 'hframes'/'vframes' line below '${key}' is not in effect yet; move it above.`;
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

  // `set_frame` opens with ERR_FAIL_INDEX (sprite_2d.cpp:296) against the grid
  // Godot holds when the write is replayed, which `gridWhenApplied` reads in
  // file order. The refusal happens at load, not at some later runtime call.
  if (rawProps.frame !== undefined) {
    const frame = ruleInt(rawProps.frame);
    const grid = gridWhenApplied(rawProps, 'frame');

    if (frame !== null && grid !== null) {
      const maxFrame = grid.hframes * grid.vframes;
      if (frame >= maxFrame) {
        diagnostics.push({
          severity: 'error',
          message:
            `Frame ${frame} is out of range. Maximum frame is ${maxFrame - 1} (hframes=${grid.hframes}, vframes=${grid.vframes}). ` +
            `Godot refuses the assignment, so the sprite loads on frame 0.` +
            (grid.late ? lateGridHint('frame') : ''),
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
      // Both ERR_FAIL_INDEXes (sprite_2d.cpp:312-313) read the same replayed
      // grid `frame` does, so the file order governs here too.
      const grid = gridWhenApplied(rawProps, 'frame_coords');

      if (grid !== null) {
        const late = grid.late ? lateGridHint('frame_coords') : '';
        if (coordX >= grid.hframes) {
          diagnostics.push({
            severity: 'error',
            message:
              `frame_coords.x (${coordX}) is out of range. Maximum is ${grid.hframes - 1} (hframes=${grid.hframes}). ` +
              `Godot refuses the assignment, so the sprite loads on frame 0.${late}`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: 'sprite2d-frame-coords-range',
          });
        }
        if (coordY >= grid.vframes) {
          diagnostics.push({
            severity: 'error',
            message:
              `frame_coords.y (${coordY}) is out of range. Maximum is ${grid.vframes - 1} (vframes=${grid.vframes}). ` +
              `Godot refuses the assignment, so the sprite loads on frame 0.${late}`,
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
