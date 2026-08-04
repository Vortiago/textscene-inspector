/**
 * Semantic linter rules for AnimationTree
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnScene } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties, extractNodePath, resolveNodePathTarget } from '../../../linter/linterUtils.js';

/**
 * Extract resource ID from SubResource("id") or ExtResource("id") format
 */
function extractResourceId(value: string): string | null {
  const match = value.match(/^(?:SubResource|ExtResource)\("([^"]+)"\)$/);
  return (match && match[1]) ? match[1] : null;
}

/**
 * Check if a resource exists in the scene
 */
function resourceExists(scene: TscnScene, resourceRef: string): boolean {
  if (!scene) return false;

  const resourceId = extractResourceId(resourceRef);
  if (!resourceId) return false;

  // Check in internalResources (SubResource)
  // Internal resources store the ID in data.id property
  if (scene.internalResources) {
    for (const resource of scene.internalResources) {
      if (resource.data && resource.data.id === resourceId) {
        return true;
      }
    }
  }

  // Check in externalResources (ExtResource)
  if (scene.externalResources) {
    for (const resource of scene.externalResources) {
      if (resource.id === resourceId) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validate AnimationTree semantic rules
 */
function checkAnimationTree(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  // Type guard for properties
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // WARNING: tree_root not set (AnimationTree won't do anything without it)
  if (!rawProps.tree_root) {
    diagnostics.push({
      severity: 'warning',
      message: `AnimationTree 'tree_root' is not set. AnimationTree requires a root animation node (AnimationNodeBlendTree or AnimationNodeStateMachine) to function.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animationtree-missing-tree-root',
    });
  }

  // ERROR: tree_root resource doesn't exist in scene
  if (rawProps.tree_root) {
    if (!resourceExists(scene, rawProps.tree_root)) {
      const resourceId = extractResourceId(rawProps.tree_root);
      diagnostics.push({
        severity: 'error',
        message: `AnimationTree 'tree_root' references resource "${resourceId}" which does not exist in the scene. Ensure the resource is defined in sub_resources or ext_resources.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'animationtree-tree-root-not-found',
      });
    }
  }

  // WARNING: anim_player not set (AnimationTree requires AnimationPlayer)
  if (!rawProps.anim_player) {
    diagnostics.push({
      severity: 'warning',
      message: `AnimationTree 'anim_player' is not set. AnimationTree requires an AnimationPlayer node to provide animations.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animationtree-missing-anim-player',
    });
  }

  // WARNING: anim_player must reference an existing AnimationPlayer node.
  // resolveNodePathTarget suppresses escapes/ambiguous paths (see its JSDoc).
  if (rawProps.anim_player) {
    const path = extractNodePath(rawProps.anim_player);
    // "." (self) is not resolvable to a concrete node here.
    if (path && path !== '.') {
      const target = resolveNodePathTarget(scene.nodes, node, path);

      if (target.status === 'missing') {
        diagnostics.push({
          severity: 'warning',
          message: `AnimationTree 'anim_player' references path "${path}" which may not exist in the scene. Ensure the AnimationPlayer node is properly defined.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'animationtree-anim-player-not-found',
        });
      } else if (target.status === 'found' && target.node.type !== 'AnimationPlayer') {
        diagnostics.push({
          severity: 'warning',
          message: `AnimationTree 'anim_player' references node "${path}" which is of type "${target.node.type}", not AnimationPlayer. AnimationTree requires an AnimationPlayer node.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'animationtree-anim-player-wrong-type',
        });
      }
    }
  }

  // WARNING: active = true but tree_root or anim_player not set
  if (rawProps.active === 'true') {
    if (!rawProps.tree_root || !rawProps.anim_player) {
      const missing: string[] = [];
      if (!rawProps.tree_root) missing.push('tree_root');
      if (!rawProps.anim_player) missing.push('anim_player');

      diagnostics.push({
        severity: 'warning',
        message: `AnimationTree is 'active' but missing required properties: ${missing.join(', ')}. The AnimationTree will not function properly until these are set.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'animationtree-active-but-incomplete',
      });
    }
  }

  // Warning: active = false
  if (rawProps.active === 'false') {
    diagnostics.push({
      severity: 'warning',
      message: `AnimationTree 'active' is set to false. The AnimationTree will not process animations until this is set to true at runtime.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animationtree-inactive',
    });
  }

  // root_motion_track set — purely informational; no diagnostic

  // audio_max_polyphony carries no advisory. The old "very low" arm (< 8) was
  // an invented threshold with nothing in the source behind it, and the "very
  // high" arm (> 128) has become a second report of the validator's own error:
  // animation_mixer.cpp:542 ERR_FAILs above 128, so the value is already
  // rejected before this rule could add anything.

  // advance_expression_base_node — purely informational; no diagnostic

  return diagnostics;
}

/**
 * AnimationTree semantic validation rule
 */
const animationTreeValidationRule: LintRule = {
  meta: {
    name: 'valid-animationtree-properties',
    description: 'Validates AnimationTree property values, resource references, and configuration dependencies',
    category: 'validation',
    applicableNodeTypes: ['AnimationTree'],
    emits: [
      { ruleName: 'animationtree-missing-tree-root', severity: 'warning' },
      { ruleName: 'animationtree-tree-root-not-found', severity: 'error' },
      { ruleName: 'animationtree-missing-anim-player', severity: 'warning' },
      { ruleName: 'animationtree-anim-player-not-found', severity: 'warning' },
      { ruleName: 'animationtree-anim-player-wrong-type', severity: 'warning' },
      { ruleName: 'animationtree-active-but-incomplete', severity: 'warning' },
      { ruleName: 'animationtree-inactive', severity: 'warning' },
    ],
  },
  check: checkAnimationTree,
};

// Self-register the rule
ruleRegistry.register(animationTreeValidationRule);

// Export for testing
export { animationTreeValidationRule };
