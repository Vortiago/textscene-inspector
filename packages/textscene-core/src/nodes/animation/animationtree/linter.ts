/**
 * Semantic linter rules for AnimationTree
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnScene } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';

/**
 * Extract resource ID from SubResource("id") or ExtResource("id") format
 */
function extractResourceId(value: string): string | null {
  const match = value.match(/^(?:SubResource|ExtResource)\("([^"]+)"\)$/);
  return (match && match[1]) ? match[1] : null;
}

/**
 * Extract NodePath value from NodePath("...") format
 */
function extractNodePath(value: string): string | null {
  const match = value.match(/^NodePath\("([^"]*)"\)$/);
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
 * Check if a NodePath points to an AnimationPlayer node
 */
function isAnimationPlayerNode(scene: TscnScene, nodePath: string): boolean {
  const path = extractNodePath(nodePath);
  if (!path) return false;

  // Try to find the node
  if (scene.nodes) {
    for (const node of scene.nodes) {
      if (node.name === path || path.endsWith(node.name)) {
        return node.type === 'AnimationPlayer';
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

  // Only run for AnimationTree nodes
  if (node.type !== 'AnimationTree') {
    return diagnostics;
  }

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

  // WARNING: anim_player NodePath may reference non-existent or wrong node type
  if (rawProps.anim_player) {
    const path = extractNodePath(rawProps.anim_player);
    if (path && path !== '..' && path !== '.') {
      // Try to validate if it's an AnimationPlayer node
      if (scene.nodes && scene.nodes.length > 0) {
        const isValidPlayer = isAnimationPlayerNode(scene, rawProps.anim_player);
        if (!isValidPlayer) {
          // Only warn if we can determine it's not an AnimationPlayer
          let found = false;
          for (const sceneNode of scene.nodes) {
            if (sceneNode.name === path || path.endsWith(sceneNode.name)) {
              found = true;
              if (sceneNode.type !== 'AnimationPlayer') {
                diagnostics.push({
                  severity: 'warning',
                  message: `AnimationTree 'anim_player' references node "${path}" which is of type "${sceneNode.type}", not AnimationPlayer. AnimationTree requires an AnimationPlayer node.`,
                  nodeName: node.name,
                  nodeType: node.type,
                  ruleName: 'animationtree-anim-player-wrong-type',
                });
              }
              break;
            }
          }

          // If path is not ".." or ".", warn about potentially missing node
          if (!found && path !== '' && !path.startsWith('..')) {
            diagnostics.push({
              severity: 'warning',
              message: `AnimationTree 'anim_player' references path "${path}" which may not exist in the scene. Ensure the AnimationPlayer node is properly defined.`,
              nodeName: node.name,
              nodeType: node.type,
              ruleName: 'animationtree-anim-player-not-found',
            });
          }
        }
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

  // INFO: active = false
  if (rawProps.active === 'false') {
    diagnostics.push({
      severity: 'info',
      message: `AnimationTree 'active' is set to false. The AnimationTree will not process animations until this is set to true at runtime.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animationtree-inactive',
    });
  }

  // INFO: root_motion_track set (common pattern, may be empty)
  if (rawProps.root_motion_track) {
    const path = extractNodePath(rawProps.root_motion_track);
    if (path && path !== '') {
      diagnostics.push({
        severity: 'info',
        message: `AnimationTree 'root_motion_track' is set to "${path}". Ensure this track exists in your animations and is properly configured for root motion.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'animationtree-root-motion-track-set',
      });
    }
  }

  // WARNING: audio_max_polyphony unusually low or high
  if (rawProps.audio_max_polyphony) {
    const polyphony = parseInt(rawProps.audio_max_polyphony, 10);
    if (!isNaN(polyphony)) {
      if (polyphony < 8) {
        diagnostics.push({
          severity: 'warning',
          message: `AnimationTree 'audio_max_polyphony' is very low (${polyphony}). This may cause audio clipping if multiple audio tracks play simultaneously.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'animationtree-low-audio-polyphony',
        });
      } else if (polyphony > 128) {
        diagnostics.push({
          severity: 'warning',
          message: `AnimationTree 'audio_max_polyphony' is very high (${polyphony}). This may impact performance. Default is 32.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'animationtree-high-audio-polyphony',
        });
      }
    }
  }

  // INFO: advance_expression_base_node set (advanced feature)
  if (rawProps.advance_expression_base_node) {
    const path = extractNodePath(rawProps.advance_expression_base_node);
    // Show info if path is set (including ".." which is a valid path)
    if (path !== '' && path !== null) {
      diagnostics.push({
        severity: 'info',
        message: `AnimationTree 'advance_expression_base_node' is set to "${path}". This is an advanced feature for custom animation timing expressions.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'animationtree-advance-expression-set',
      });
    }
  }

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
  },
  check: checkAnimationTree,
};

// Self-register the rule
ruleRegistry.register(animationTreeValidationRule);

// Export for testing
export { animationTreeValidationRule };
