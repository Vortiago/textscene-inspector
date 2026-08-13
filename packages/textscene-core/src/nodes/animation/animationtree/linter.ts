/**
 * Semantic linter rules for AnimationTree
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnScene } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties, extractNodePath } from '../../../linter/linterUtils.js';
import { resolveNodePath } from '../../../linter/nodePathResolve.js';
import { RESOURCE_REF_RE } from '../../../godot/index.js';
import { heldResource } from '../../../linter/resourceChecker.js';

/**
 * Extract resource ID from SubResource("id") or ExtResource("id") format
 */
function extractResourceId(value: string): string | null {
  return RESOURCE_REF_RE.exec(value)?.[2] ?? null;
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

  // WARNING: tree_root not set (AnimationTree won't do anything without it).
  // A cleared slot (`tree_root = null`) is a set-to-nothing, which is exactly
  // what this warning is about, so it counts as absent here and as not-dangling
  // below. One predicate, so the two arms cannot drift apart.
  const treeRoot = heldResource(rawProps.tree_root);
  if (treeRoot === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `AnimationTree 'tree_root' is not set. AnimationTree requires a root animation node (AnimationNodeBlendTree or AnimationNodeStateMachine) to function.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animationtree-missing-tree-root',
    });
  } else if (!resourceExists(scene, treeRoot)) {
    // ERROR: tree_root resource doesn't exist in scene
    const resourceId = extractResourceId(treeRoot);
    diagnostics.push({
      severity: 'error',
      message: `AnimationTree 'tree_root' references resource "${resourceId}" which does not exist in the scene. Ensure the resource is defined in sub_resources or ext_resources.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animationtree-tree-root-not-found',
    });
  }

  // An absent `anim_player` gets no diagnostic: set_animation_player treats the
  // empty path as a supported mode and reconfigures the root node for it.

  // WARNING: anim_player must reference an existing AnimationPlayer node.
  // resolveNodePath's one decline, `unknowable`, covers every path whose answer
  // lives in another file (see its JSDoc); `..` resolves rather than declining.
  if (rawProps.anim_player) {
    const path = extractNodePath(rawProps.anim_player);
    // "." (self) is not resolvable to a concrete node here.
    if (path && path !== '.') {
      const target = resolveNodePath(scene, node, path);

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

  // Warning: active = false. Not a port of get_configuration_warnings() —
  // AnimationTree has none. The wording is adapted from
  // `get_editor_error_message()` (animation_tree.cpp:995-997), a
  // `TOOLS_ENABLED`-only method Godot calls to render text INSIDE the
  // blend-tree graph editor, not from `get_configuration_warnings()`.
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
      { ruleName: 'animationtree-missing-tree-root', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      {
        ruleName: 'animationtree-tree-root-not-found',
        severity: 'error',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the file declares no ExtResource or SubResource carrying that id',
        },
      },
      {
        ruleName: 'animationtree-anim-player-not-found',
        severity: 'warning',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the path names a node the file never declares',
        },
      },
      {
        ruleName: 'animationtree-anim-player-wrong-type',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'animation_tree.cpp:1020' },
      },
      {
        ruleName: 'animationtree-inactive',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'animation_mixer.cpp:446',
          unused: 'processing is gated on active, so the blend tree never advances',
        },
      },
    ],
  },
  check: checkAnimationTree,
};

// Self-register the rule
ruleRegistry.register(animationTreeValidationRule);

// Export for testing
export { animationTreeValidationRule };
