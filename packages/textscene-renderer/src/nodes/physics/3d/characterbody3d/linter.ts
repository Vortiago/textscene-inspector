/**
 * Semantic linter rules for CharacterBody3D
 *
 * Format validation (motion_mode, angles, Vector3 format, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., collision shape children, floor settings).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';

/**
 * Minimum recommended floor_snap_length (below this, floor snapping may not work well)
 */
const MIN_RECOMMENDED_FLOOR_SNAP = 0.001;

/**
 * Maximum recommended floor_snap_length (above this can cause glitchy behavior)
 */
const MAX_RECOMMENDED_FLOOR_SNAP = 10;

/**
 * Check if a node has any CollisionShape3D children (recursively)
 */
function hasCollisionShapeChild(node: TscnNode): boolean {
  for (const child of node.children) {
    if (child.type === 'CollisionShape3D') {
      return true;
    }
    // Check recursively in case collision shapes are nested deeper
    if (hasCollisionShapeChild(child)) {
      return true;
    }
  }
  return false;
}

/**
 * Validate CharacterBody3D semantic rules
 */
function checkCharacterBody3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  // Only run for CharacterBody3D nodes
  if (node.type !== 'CharacterBody3D') {
    return diagnostics;
  }

  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // Warning: CharacterBody3D without CollisionShape3D children is useless
  if (!hasCollisionShapeChild(node)) {
    diagnostics.push({
      severity: 'warning',
      message: `CharacterBody3D '${node.name}' has no CollisionShape3D children. Character bodies need collision shapes to function in physics.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'characterbody3d-needs-collision-shape',
    });
  }

  // Warning: Extreme floor_snap_length values
  if (rawProps.floor_snap_length !== undefined) {
    const snapLength = parseFloat(rawProps.floor_snap_length);
    if (!isNaN(snapLength)) {
      if (snapLength > 0 && snapLength < MIN_RECOMMENDED_FLOOR_SNAP) {
        diagnostics.push({
          severity: 'warning',
          message: `CharacterBody3D '${node.name}' has very small floor_snap_length (${snapLength}). Values below ${MIN_RECOMMENDED_FLOOR_SNAP} may not work reliably for floor snapping.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'characterbody3d-floor-snap-too-small',
        });
      }
      if (snapLength > MAX_RECOMMENDED_FLOOR_SNAP) {
        diagnostics.push({
          severity: 'warning',
          message: `CharacterBody3D '${node.name}' has very large floor_snap_length (${snapLength}). Values above ${MAX_RECOMMENDED_FLOOR_SNAP} can cause glitchy behavior or unwanted floor attachment.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'characterbody3d-floor-snap-too-large',
        });
      }
    }
  }

  // Warning: Floor-specific properties set but motion_mode is FLOATING (1)
  const motionMode = rawProps.motion_mode !== undefined ? parseInt(rawProps.motion_mode, 10) : 0;
  if (motionMode === 1) {
    // FLOATING mode
    const floorProperties = [
      'floor_stop_on_slope',
      'floor_constant_speed',
      'floor_block_on_wall',
      'floor_max_angle',
      'floor_snap_length',
    ];

    for (const prop of floorProperties) {
      if (rawProps[prop] !== undefined) {
        diagnostics.push({
          severity: 'warning',
          message: `CharacterBody3D '${node.name}' has motion_mode=FLOATING but '${prop}' is set. Floor properties only work in GROUNDED mode (motion_mode=0).`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'characterbody3d-floor-props-in-floating-mode',
        });
        break; // Only warn once for all floor properties
      }
    }
  }

  // Warning: collision_layer is 0 (body won't be on any layer)
  if (rawProps.collision_layer !== undefined) {
    const collisionLayer = parseInt(rawProps.collision_layer, 10);
    if (!isNaN(collisionLayer) && collisionLayer === 0) {
      diagnostics.push({
        severity: 'warning',
        message: `CharacterBody3D '${node.name}' has collision_layer set to 0. The body won't be on any collision layer and may not interact with other physics objects.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'characterbody3d-zero-collision-layer',
      });
    }
  }

  // Warning: collision_mask is 0 (body won't collide with anything)
  if (rawProps.collision_mask !== undefined) {
    const collisionMask = parseInt(rawProps.collision_mask, 10);
    if (!isNaN(collisionMask) && collisionMask === 0) {
      diagnostics.push({
        severity: 'warning',
        message: `CharacterBody3D '${node.name}' has collision_mask set to 0. The body won't collide with any layers and may not detect collisions.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'characterbody3d-zero-collision-mask',
      });
    }
  }

  // Info: Unusual up_direction (not the standard Vector3(0, 1, 0))
  if (rawProps.up_direction !== undefined) {
    const upDirRegex = /^Vector3\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;
    const match = upDirRegex.exec(rawProps.up_direction);
    if (match) {
      const x = parseFloat(match[1] || '0');
      const y = parseFloat(match[2] || '0');
      const z = parseFloat(match[3] || '0');
      // Standard up direction is Vector3(0, 1, 0)
      if (!(x === 0 && y === 1 && z === 0)) {
        diagnostics.push({
          severity: 'info',
          message: `CharacterBody3D '${node.name}' has non-standard up_direction: ${rawProps.up_direction}. Standard is Vector3(0, 1, 0). Ensure this is intentional for your game's orientation.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'characterbody3d-non-standard-up-direction',
        });
      }
    }
  }

  // Warning: max_slides too low (may cause jittery movement)
  if (rawProps.max_slides !== undefined) {
    const maxSlides = parseInt(rawProps.max_slides, 10);
    if (!isNaN(maxSlides) && maxSlides > 0 && maxSlides < 4) {
      diagnostics.push({
        severity: 'warning',
        message: `CharacterBody3D '${node.name}' has max_slides=${maxSlides}. Values below 4 may cause jittery movement on complex geometry. Recommended: 4-6.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'characterbody3d-max-slides-too-low',
      });
    }
  }

  // Warning: Very large safe_margin can cause tunneling or unwanted collisions
  if (rawProps.safe_margin !== undefined) {
    const safeMargin = parseFloat(rawProps.safe_margin);
    if (!isNaN(safeMargin) && safeMargin > 0.1) {
      diagnostics.push({
        severity: 'warning',
        message: `CharacterBody3D '${node.name}' has large safe_margin (${safeMargin}). Values above 0.1 may cause collision detection issues. Typical range: 0.001-0.1.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'characterbody3d-safe-margin-too-large',
      });
    }
  }

  return diagnostics;
}

/**
 * CharacterBody3D semantic validation rule
 */
const characterBody3DValidationRule: LintRule = {
  meta: {
    name: 'valid-characterbody3d',
    description: 'Validates CharacterBody3D collision shapes, motion mode settings, floor/wall properties, and physics configuration',
    category: 'validation',
    applicableNodeTypes: ['CharacterBody3D'],
  },
  check: checkCharacterBody3D,
};

// Self-register the rule
ruleRegistry.register(characterBody3DValidationRule);

// Export for testing
export { characterBody3DValidationRule };
