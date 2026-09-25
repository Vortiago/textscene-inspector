/**
 * AnimationTree strict validators. `parameters/<path>` is a hand-rolled `_set`/`_get` route
 * (animation_tree.cpp:969-977), a class propertyListRouteCoverage.test.ts tracks.
 */

// The base chain. Registration happens on import, so a test that loads only this slice resolves
// an inherited key only when the ancestor is imported too. AnimationMixer, not Node:
// `anims/<name>`, `libraries` and `libraries/<name>` are its own hand-rolled route, and its
// linterParser.ts chains to Node.
import '../animationmixer/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { shape, v } from '../../../linter/validators/index.js';

const PROCESS_MODE = { 0: 'PHYSICS', 1: 'IDLE', 2: 'MANUAL' };

validatorRegistry.registerAll('AnimationTree', {
  // animation_tree.cpp:1018, PROPERTY_HINT_RESOURCE_TYPE "AnimationRootNode":
  // rejects only a malformed reference, no magnitude to ground.
  tree_root: v.resourceReference('tree_root'),
  // animation_tree.cpp:1020, PROPERTY_HINT_NODE_PATH_VALID_TYPES "AnimationPlayer".
  // set_animation_player (:845-855) is a bare assignment (an empty path even
  // resets root_node/animation_libraries deliberately, not a rejection).
  anim_player: v.nodePath('anim_player'),
  // AnimationMixer's own members are registered on the 'AnimationMixer' tier and reach this type
  // through the base walk. The 3.x compat alias below is AnimationTree's own:
  // animation_player.cpp:57-58, redirected through callback_mode_process
  // (animation_mixer.cpp:501-509), a bare assignment with no range check on the raw int.
  process_callback: v.enumInt('process_callback', 0, 2, PROCESS_MODE, {
    hinted: 'animation_mixer.cpp:2471',
  }),
  // animation_tree.cpp:1019, PROPERTY_HINT_NODE_PATH_VALID_TYPES "Node".
  // set_advance_expression_base_node (:697-699) is a bare assignment.
  advance_expression_base_node: v.nodePath('advance_expression_base_node'),

  // animation_tree.cpp:767-829 (_update_properties_for_node) builds these from each live
  // AnimationNode's get_parameter_list, so the PropertyInfo behind a leaf depends on the graph
  // shape, but the "parameters/" prefix is fixed. As with ShaderGlobalsOverride's params/*
  // (shaderglobalsoverride/linterParser.ts), the `.tscn` alone proves only that the key exists.
  'parameters/*': shape(
    () => null,
    "any Variant — the type comes from the live AnimationNode graph, not the .tscn"
  ),
});
