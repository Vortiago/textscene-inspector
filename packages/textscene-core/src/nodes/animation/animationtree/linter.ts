/**
 * Semantic linter rules for AnimationTree
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties, extractNodePath } from '../../../linter/linterUtils.js';
import { resolveNodePath } from '../../../linter/nodePathResolve.js';
import { boolSlotValue } from '../../../godot/index.js';
import { heldResource } from '../../../linter/resourceChecker.js';

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
  // what this warning is about, so it counts as absent here.
  if (heldResource(rawProps.tree_root) === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `AnimationTree 'tree_root' is not set. AnimationTree requires a root animation node (AnimationNodeBlendTree or AnimationNodeStateMachine) to function.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animationtree-missing-tree-root',
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
          severity: 'info',
          message: `AnimationTree 'anim_player' references node "${path}" which is of type "${target.node.type}", not AnimationPlayer. AnimationTree requires an AnimationPlayer node.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'animationtree-anim-player-wrong-type',
        });
      }
    }
  }

  // Warning: active = false. Not a port of
  // `AnimationTree::get_configuration_warnings()` (animation_tree.cpp:717-723),
  // whose one row is the null `root_animation_node` that
  // `animationtree-missing-tree-root` above already carries. The wording here is
  // adapted from `get_editor_error_message()` (animation_tree.cpp:995-997), a
  // `TOOLS_ENABLED`-only method Godot calls to render text INSIDE the
  // blend-tree graph editor.
  if (boolSlotValue(rawProps.active) === false) {
    diagnostics.push({
      severity: 'info',
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
        severity: 'info',
        // NOT animation_tree.cpp:1020: that ADD_PROPERTY's
        // PROPERTY_HINT_NODE_PATH_VALID_TYPES filters the inspector's node
        // picker and constrains no stored value. set_animation_player
        // (:845-856) bare-assigns any path; the type is consulted only here.
        grounding: {
          kind: 'engine-inert',
          at: 'animation_tree.cpp:875-876',
          unused: 'the cast to AnimationPlayer yields null and the whole setup block is skipped, so the tree binds to no player and plays nothing',
        },
      },
      {
        ruleName: 'animationtree-inactive',
        severity: 'info',
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
