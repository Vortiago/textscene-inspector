/**
 * AnimationPlayer strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `autoplay` and `root_node` used to hand-roll an empty-string rejection, but
 * animation_player.cpp:775 (`set_autoplay`) and animation_mixer.cpp:484
 * (`set_root_node`) are both bare assignments, and an empty StringName/NodePath
 * is Godot's own "nothing set" state (autoplay: line 150's `animation_set.has(autoplay)`
 * guard; root_node: animation_mixer.cpp:2499 defaults it to `NodePath("..")`, not
 * empty, but nothing refuses an empty one either) — rejecting it was a false
 * positive. Both are now plain `v` combinators matching their real Variant type.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const PROCESS_MODE = { 0: 'PHYSICS', 1: 'IDLE', 2: 'MANUAL' };
const METHOD_CALL_MODE = { 0: 'DEFERRED', 1: 'IMMEDIATE' };

validatorRegistry.registerAll('AnimationPlayer', {
  // animation_player.cpp:1048, PROPERTY_HINT_RANGE "-4,4,0.001,or_less,or_greater":
  // both ends open, and set_speed_scale (:648) is a bare assignment, so the only
  // thing to reject is a non-number.
  speed_scale: v.float('speed_scale'),
  // animation_player.cpp:822 is a bare assignment, so the hint at :1046
  // ("0,4096,0.01") is advisory: out-of-range is a warning in linter.ts.
  playback_default_blend_time: v.float('playback_default_blend_time'),
  // animation_player.cpp:1035/:57-59, redirected through AnimationMixer's
  // callback_mode_process/method (animation_mixer.cpp:501-509,522-525): both
  // bare assignments, no engine-side range check on the raw int.
  playback_process_mode: v.enumInt('playback_process_mode', 0, 2, PROCESS_MODE, {
    hinted: 'animation_mixer.cpp:2471',
  }),
  method_call_mode: v.enumInt('method_call_mode', 0, 1, METHOD_CALL_MODE, {
    hinted: 'animation_mixer.cpp:2472',
  }),
  playback_active: v.boolean('playback_active'),
  // animation_player.cpp:1037, Variant::STRING_NAME, PROPERTY_HINT_NONE.
  // set_autoplay (:770-776) is a bare assignment; empty is "no autoplay".
  autoplay: v.stringName('autoplay'),
  current_animation: v.any(),
  // animation_mixer.cpp:2461, Variant::NODE_PATH, no hint text at all.
  // set_root_node (:483-486) is a bare assignment; empty is accepted too.
  root_node: v.nodePath('root_node'),
  // current_animation_length/current_animation_position (animation_player.cpp:1038-1039)
  // are PROPERTY_HINT_NONE + PROPERTY_USAGE_NONE with an empty setter method name
  // ("", "get_current_animation_length"/"get_current_animation_position"): getter-only
  // and never serialised, so they can never appear in a real .tscn. No validator to carry.
});
