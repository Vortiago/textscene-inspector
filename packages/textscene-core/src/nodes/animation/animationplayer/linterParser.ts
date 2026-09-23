/**
 * AnimationPlayer strict validators. `set_root_node` (animation_mixer.cpp:484) is a bare
 * assignment and nothing refuses an empty NodePath, though animation_mixer.cpp:2499 defaults it to
 * `NodePath("..")`. `playback/play`, `next/<name>` and `blend_times` are hand-rolled `_set`/`_get`
 * keys (animation_player.cpp:36-66), a class propertyListRouteCoverage.test.ts tracks.
 */

// The base chain. Registration happens on import, so a test that loads only this slice resolves
// an inherited key only when the ancestor is imported too. AnimationMixer, not Node:
// `anims/<name>`, `libraries` and `libraries/<name>` are its own hand-rolled route, and its
// linterParser.ts chains to Node.
import '../animationmixer/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { accepts, propertyError, v } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { dropTrailingComma, splitTopLevel } from '../../../godot/string.js';
import { ARRAY_LITERAL_RE } from '../../../godot/index.js';

const PROCESS_MODE = { 0: 'PHYSICS', 1: 'IDLE', 2: 'MANUAL' };
const METHOD_CALL_MODE = { 0: 'DEFERRED', 1: 'IMMEDIATE' };
// Tween::TransitionType / Tween::EaseType (tween.h:82-95, :98-103): the
// hint_string order at animation_player.cpp:1044/:1045 matches the C++ enum
// declaration order, so these count and label straight from it.
const AUTO_CAPTURE_TRANSITION_TYPE = {
  0: 'LINEAR',
  1: 'SINE',
  2: 'QUINT',
  3: 'QUART',
  4: 'QUAD',
  5: 'EXPO',
  6: 'ELASTIC',
  7: 'CUBIC',
  8: 'CIRC',
  9: 'BOUNCE',
  10: 'BACK',
  11: 'SPRING',
};
const AUTO_CAPTURE_EASE_TYPE = { 0: 'IN', 1: 'OUT', 2: 'IN_OUT', 3: 'OUT_IN' };


/**
 * `blend_times`: a flat Array of (from: StringName, to: StringName, time: float) triples
 * (animation_player.cpp:79-92 builds it, :43-53 reads it). A length not a multiple of 3 drops the
 * write (`ERR_FAIL_COND_V(len % 3, false)`, :46). Only the count is checked: a non-string name
 * reads as empty (variant.cpp:1545-1553) and `time` coerces too, so Godot loads any element.
 */
const blendTimesValidator: PropertyValidator = accepts((key, value, line) => {
  const match = ARRAY_LITERAL_RE.exec(value.trim());
  if (!match) {
    return propertyError(
      key,
      line,
      `Property 'blend_times' must be an Array literal like [], got: ${value}`,
      'INVALID_BLEND_TIMES_FORMAT'
    );
  }
  // `dropTrailingComma`: `[a, b, 0.5,]` loads as three elements
  // (variant_parser.cpp:1643-1677).
  const count = dropTrailingComma(splitTopLevel(match[1]!)).length;
  if (count % 3 !== 0) {
    return propertyError(
      key,
      line,
      `Property 'blend_times' must be a flat list of (from, to, time) triples; got ${count} element(s), not a multiple of 3 (animation_player.cpp:46)`,
      'INVALID_BLEND_TIMES_COUNT'
    );
  }
  return null;
}, 'Array literal of (from, to, time) triples');
blendTimesValidator.grounding = { kind: 'enforced', cite: 'animation_player.cpp:46' };

validatorRegistry.registerAll('AnimationPlayer', {
  // animation_player.cpp:1048, PROPERTY_HINT_RANGE "-4,4,0.001,or_less,or_greater":
  // both ends open, and set_speed_scale (:648) is a bare assignment, so the only
  // thing to reject is a non-number.
  speed_scale: v.float('speed_scale'),
  // animation_player.cpp:1049, Variant::BOOL, PROPERTY_HINT_NONE.
  // set_movie_quit_on_finish_enabled (:782-784) is a bare assignment.
  movie_quit_on_finish: v.boolean('movie_quit_on_finish'),
  // animation_player.cpp:1042, Variant::BOOL, PROPERTY_HINT_NONE.
  // set_auto_capture (:857-858) is a bare assignment (plus a
  // notify_property_list_changed for the conditional sibling visibility at
  // :125, which does not touch the stored value).
  playback_auto_capture: v.boolean('playback_auto_capture'),
  // animation_player.cpp:1043, Variant::FLOAT, PROPERTY_HINT_NONE, "suffix:s":
  // a suffix is not a bound (ADR-0032). set_auto_capture_duration (:866-868)
  // is a bare assignment, so this is a format check only.
  playback_auto_capture_duration: v.float('playback_auto_capture_duration'),
  // animation_player.cpp:1044, PROPERTY_HINT_ENUM
  // "Linear,Sine,Quint,Quart,Quad,Expo,Elastic,Cubic,Circ,Bounce,Back,Spring"
  // (12 values, Tween::TransitionType). set_auto_capture_transition_type
  // (:874-876) is a bare assignment, so out-of-range only warns.
  playback_auto_capture_transition_type: v.enumInt(
    'playback_auto_capture_transition_type',
    0,
    11,
    AUTO_CAPTURE_TRANSITION_TYPE,
    { hinted: 'animation_player.cpp:1044' }
  ),
  // animation_player.cpp:1045, PROPERTY_HINT_ENUM "In,Out,InOut,OutIn"
  // (4 values, Tween::EaseType). set_auto_capture_ease_type (:882-884) is a
  // bare assignment, so out-of-range only warns.
  playback_auto_capture_ease_type: v.enumInt(
    'playback_auto_capture_ease_type',
    0,
    3,
    AUTO_CAPTURE_EASE_TYPE,
    { hinted: 'animation_player.cpp:1045' }
  ),
  // animation_player.cpp:1046 hints "0,4096,0.01,suffix:s", closed both ends.
  // set_default_blend_time (animation_player.cpp:823) is a bare assignment, so
  // both ends are the hint's alone and warn.
  playback_default_blend_time: v.float('playback_default_blend_time', {
    min: 0,
    max: 4096,
    hinted: 'animation_player.cpp:1046',
  }),
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
  // animation_player.cpp:1037, Variant::STRING_NAME, PROPERTY_HINT_NONE. set_autoplay (:770-776)
  // is a bare assignment (animation_player.cpp:775), and empty means no autoplay: line 150 guards
  // on `animation_set.has(autoplay)`.
  autoplay: v.stringName('autoplay'),
  current_animation: v.any(),
  // current_animation_length/current_animation_position (animation_player.cpp:1038-1039)
  // are PROPERTY_HINT_NONE + PROPERTY_USAGE_NONE with an empty setter method name
  // ("", "get_current_animation_length"/"get_current_animation_position"): getter-only
  // and never serialised, so they can never appear in a real .tscn. No validator to carry.

  // animation_player.cpp:38-39,71-73, "For backward compatibility.": `_set` forwards any
  // `playback/play*` name into `set_current_animation`, the field `current_animation` sets, so it
  // gets the same permissive check. `_get_property_list` never pushes it, so only a hand-edited or
  // legacy scene reaches it.
  'playback/play': v.any(),

  // animation_player.cpp:130-138: pushed only for an animation with a "next" override, usage
  // NO_EDITOR|INTERNAL, still storage-bearing (object.h:132). `stringName`, not `quotedString`:
  // the getter `animation_get_next` returns a StringName (animation_player.h:181), so Godot writes
  // `&"idle"` though the PropertyInfo declares Variant::STRING (`unit-animation-player.tscn`).
  'next/*': v.stringName('next'),

  // animation_player.cpp:144 (_get_property_list) / :43-53 (_get) / :79-92
  // (_set): flat Array of (from, to, time) triples, see blendTimesValidator.
  blend_times: blendTimesValidator,
});
