/**
 * Semantic linter rules for AnimationTree. linterParser.ts validates the format during strict
 * parsing. These rules need the full scene.
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


  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // An AnimationTree without a tree_root does nothing. A cleared slot
  // (`tree_root = null`) counts as absent.
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

  // anim_player must reference an existing AnimationPlayer node.
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

  // active = false. Not a port of `AnimationTree::get_configuration_warnings()`
  // (animation_tree.cpp:717-723), whose one row is the null root that
  // `animationtree-missing-tree-root` carries. The wording follows the `TOOLS_ENABLED`-only
  // `get_editor_error_message()` (animation_tree.cpp:995-997), shown inside the blend-tree editor.
  if (boolSlotValue(rawProps.active) === false) {
    diagnostics.push({
      severity: 'info',
      message: `AnimationTree 'active' is set to false. The AnimationTree will not process animations until this is set to true at runtime.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'animationtree-inactive',
    });
  }

  // root_motion_track and advance_expression_base_node get no diagnostic.

  // audio_max_polyphony carries no advisory: Godot states no low threshold, and
  // animation_mixer.cpp:542 ERR_FAILs above 128, so the validator already errors there.

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
        // Not animation_tree.cpp:1020: that ADD_PROPERTY's
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

ruleRegistry.register(animationTreeValidationRule);

// Export for testing
export { animationTreeValidationRule };
