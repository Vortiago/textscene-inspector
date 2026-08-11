/**
 * AnimationTree strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `tree_root` keeps a bespoke validator: linter.test.ts:90 pins the
 * contiguous substring "SubResource or ExtResource" in its diagnostic,
 * which `v.resourceReference`'s "SubResource(\"id\") or ExtResource(\"id\")"
 * template does not contain. `anim_player`, `root_motion_track`,
 * `advance_expression_base_node` and `root_node` moved to `v.nodePath`:
 * no test pins their old bespoke wording, and the regex is identical.
 *
 * `parameters/<path>` is a fourth hand-rolled route (animation_tree.cpp:969-977):
 * see propertyListRouteCoverage.test.ts.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it. AnimationMixer,
// not Node directly: `anims/<name>`/`libraries`/`libraries/<name>` are its own
// hand-rolled route, and AnimationMixer's own linterParser.ts already chains
// to Node in turn.
import '../animationmixer/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { shape, v } from '../../../linter/validators/index.js';
import { propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { RESOURCE_REF_RE } from '../../../godot/index.js';

const PROCESS_MODE = { 0: 'PHYSICS', 1: 'IDLE', 2: 'MANUAL' };

function resourceRef(name: string, code: string): PropertyValidator {
  const validator: PropertyValidator = (key, value, line) => {
    if (!RESOURCE_REF_RE.test(value.trim())) {
      return propertyError(key, line, `Property '${name}' must be a SubResource or ExtResource reference, got: "${value}"`, code);
    }
    return null;
  };
  validator.accepts = 'SubResource("id") or ExtResource("id")';
  // animation_tree.cpp:1018, PROPERTY_HINT_RESOURCE_TYPE "AnimationRootNode":
  // rejects only a malformed reference, no magnitude to ground. Kept hand-rolled
  // (rather than v.resourceReference) because linter.test.ts:90 pins this exact
  // message substring.
  validator.formatOnly = true;
  return validator;
}

validatorRegistry.registerAll('AnimationTree', {
  tree_root: resourceRef('tree_root', 'INVALID_TREE_ROOT_FORMAT'),
  // animation_tree.cpp:1020, PROPERTY_HINT_NODE_PATH_VALID_TYPES "AnimationPlayer".
  // set_animation_player (:845-855) is a bare assignment (an empty path even
  // resets root_node/animation_libraries deliberately, not a rejection).
  anim_player: v.nodePath('anim_player'),
  // AnimationMixer's own members (active, the three callback modes,
  // root_motion_track/_local, root_node, deterministic, reset_on_save,
  // audio_max_polyphony) are registered once on the 'AnimationMixer' tier and
  // reach this type through the base-walk. Only the 3.x compat alias below is
  // AnimationTree's own.
  //
  // animation_player.cpp:57-58, redirected through AnimationMixer's
  // callback_mode_process (animation_mixer.cpp:501-509): a bare assignment,
  // no engine-side range check on the raw int.
  process_callback: v.enumInt('process_callback', 0, 2, PROCESS_MODE, {
    hinted: 'animation_mixer.cpp:2471',
  }),
  // animation_tree.cpp:1019, PROPERTY_HINT_NODE_PATH_VALID_TYPES "Node".
  // set_advance_expression_base_node (:697-699) is a bare assignment.
  advance_expression_base_node: v.nodePath('advance_expression_base_node'),

  // animation_tree.cpp:767-829 (_update_properties_for_node) builds this
  // recursively from each live AnimationNode's own get_parameter_list, so the
  // PropertyInfo behind a given leaf comes from a different C++ class per
  // graph shape (StateMachine/BlendTree/Animation/...) — genuinely dynamic,
  // but the key PREFIX ("parameters/") is fixed. Same shape as
  // ShaderGlobalsOverride's params/* (shaderglobalsoverride/linterParser.ts):
  // the only honest claim from the .tscn alone is that the key exists.
  'parameters/*': shape(
    () => null,
    "any Variant — the type comes from the live AnimationNode graph, not the .tscn"
  ),
});
