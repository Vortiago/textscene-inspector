/**
 * Semantic linter rules for Sprite3D
 *
 * Note: Format validation (billboard values, pixel_size, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., resource references exist, frame validation).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists, heldResource } from '../../../linter/resourceChecker.js';
import { ruleInt } from '../../../linter/validators/commonValidators.js';
import { matchVector2i } from '../../../linter/validators/vectorValidators.js';
import { boolSlotValue } from '../../../godot/index.js';
import { replayPositions } from '../../../godot/propertyReplay.js';

/**
 * The grid count Godot ACTUALLY holds, or `null` for a literal no rule can use.
 *
 * An absent key is Godot's default of 1. So is any value below it: `set_hframes`
 * and `set_vframes` both open with `ERR_FAIL_COND_MSG(p_amount < 1)`
 * (sprite_3d.cpp:905, :924), so the write is refused and the default stands. Reading
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
 * The declaration order at `sprite_3d.cpp:1014-1016` is the order Godot SAVES
 * in and binds nothing a hand-authored body has to follow; `replayPositions`
 * holds the fact that the FILE's order is what `SceneState::instantiate`
 * applies. So an `hframes` line below `frame` is still at its default of 1 when
 * `set_frame`'s ERR_FAIL_INDEX runs, exactly as on the 2D twin.
 */
function gridWhenApplied(rawProps: Record<string, string>, key: string): AppliedGrid | null {
  const at = replayPositions(rawProps, key, ['hframes', 'vframes']);
  const grid: AppliedGrid = {
    hframes: 1,
    vframes: 1,
    late: at.hframes!.late || at.vframes!.late,
  };
  for (const axis of ['hframes', 'vframes'] as const) {
    const raw = at[axis]!.applied;
    if (raw === undefined) continue;
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
 * Validate Sprite3D semantic rules (resource references, frame validation, etc.)
 */
function checkSprite3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // Check if texture resource exists (REQUIRED - Sprite3D is useless without texture)
  const texture = heldResource(rawProps.texture);
  if (texture === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `Sprite3D requires a 'texture' property. Sprite3D is not visible without a texture.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'sprite3d-requires-texture',
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
        ruleName: 'valid-sprite3d-resources',
      });
    }
  }

  // `set_frame` opens with ERR_FAIL_INDEX (sprite_3d.cpp:878), judged against
  // the grid Godot holds when the write is replayed — which `gridWhenApplied`
  // reads in file order, not in `_bind_methods` order.
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
          ruleName: 'sprite3d-frame-range',
        });
      }
    }
  }

  // `set_frame_coords` ERR_FAIL_INDEXes each component against the grid
  // (sprite_3d.cpp:894-895) — the same guard the 2D twin reports on, and cited
  // by this slice's `frame_coords` validator, whose `min` half was the only one
  // being checked.
  if (rawProps.frame_coords !== undefined) {
    // `null` for a component no int32 holds: linterParser.ts reports that, and
    // the narrowed value is not a coordinate to name.
    const coords = matchVector2i(rawProps.frame_coords);
    if (coords) {
      const { x: coordX, y: coordY } = coords;
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
            ruleName: 'sprite3d-frame-coords-range',
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
            ruleName: 'sprite3d-frame-coords-range',
          });
        }
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
        ruleName: 'sprite3d-frame-coords-range',
        severity: 'error',
        grounding: { kind: 'engine', at: 'sprite_3d.cpp:894' },
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
