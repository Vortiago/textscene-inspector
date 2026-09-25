/**
 * AnimationMixer strict validators, registered under the abstract key 'AnimationMixer', the base of
 * AnimationPlayer and AnimationTree, as `canvasitem/shared/linterParser.ts` does for CanvasItem.
 * Godot cannot instantiate AnimationMixer, so it owns no node slice, and its descendants inherit
 * these through the NODE_BASE_TYPES base-walk.
 */

import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { accepts, propertyError, v } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

/**
 * `{ "name": SubResource/ExtResource(...), ... }`, the whole library set at once
 * (animation_mixer.cpp:72-81). Format only, like `GraphEdit.type_names`: a malformed entry drops only
 * that library (`add_animation_library`'s `ERR_FAIL_COND_V`s, animation_mixer.cpp:305), and a real
 * Godot export never writes this legacy key.
 */
const LIBRARIES_DICT_RE = /^\{[\s\S]*\}$/;

const librariesValidator: PropertyValidator = accepts((key, value, line) => {
  if (!LIBRARIES_DICT_RE.test(value.trim())) {
    return propertyError(
      key,
      line,
      `Property 'libraries' must be a Dictionary literal like {} or { "": SubResource("id") }, got: ${value}`,
      'INVALID_LIBRARIES_FORMAT'
    );
  }
  return null;
}, 'Dictionary literal ({…}) of name -> AnimationLibrary');
librariesValidator.formatOnly = true;

// The first three keys are the hand-rolled `_set`/`_get` routes (animation_mixer.cpp:55-134), which
// no ADD_PROPERTY or XML sweep sees.
validatorRegistry.registerAll('AnimationMixer', {
  // animation_mixer.cpp:58-71, #ifndef DISABLE_DEPRECATED (on by default): a
  // 3.x scene's `anims/Walk = SubResource(...)` reads an Animation resource
  // straight into the default (unnamed) library. `_get_property_list` never
  // lists it, so only a legacy or hand-authored scene carries it.
  'anims/*': v.resourceReference('anims'),

  // animation_mixer.cpp:72-81, same guard: the whole library set as one
  // Dictionary, key = library name (possibly "" for the default library),
  // value = an AnimationLibrary reference.
  libraries: librariesValidator,

  // animation_mixer.cpp:129-134 (_get_property_list) / 82-99 (_set) / 111-117
  // (_get): PROPERTY_HINT_RESOURCE_TYPE "AnimationLibrary", always storage-bearing per
  // _get_libraries_property_usage (:125-127). AnimationTree's READ_ONLY flag hides it only from
  // the inspector.
  'libraries/*': v.resourceReference('libraries'),

  // AnimationMixer's ten ordinary members (animation_mixer.cpp:2458-2473), declared here so the
  // base-walk gives AnimationPlayer and AnimationTree the same set. `ownValidatorCoverage` counts
  // types with zero own validators, so the property-list keys alone would hide these ten.
  active: v.boolean('active'),
  deterministic: v.boolean('deterministic'),
  reset_on_save: v.boolean('reset_on_save'),
  root_node: v.nodePath('root_node'),
  root_motion_track: v.nodePath('root_motion_track'),
  root_motion_local: v.boolean('root_motion_local'),
  // Two tiers on both ends. animation_mixer.cpp:542
  // `ERR_FAIL_COND(p < 0 || p > 128)` refuses outside 0..128, and the hint at
  // :2468 is the narrower `1,127,1`, so 0 and 128 clear the setter while
  // sitting outside what the inspector offers.
  audio_max_polyphony: v.int('audio_max_polyphony', {
    min: 1,
    max: 127,
    enforcedMin: { at: 0 },
    enforcedMax: { at: 128 },
    enforced: { min: 'animation_mixer.cpp:542', max: 'animation_mixer.cpp:542' },
    hinted: { min: 'animation_mixer.cpp:2468', max: 'animation_mixer.cpp:2468' },
  }),
  // :2471-2473, three ENUM hints whose setters (:501, :522, :531) all assign
  // straight through with no ERR_FAIL_INDEX, so out of range is a warning.
  callback_mode_process: v.enumInt(
    'callback_mode_process',
    0,
    2,
    { 0: 'PHYSICS', 1: 'IDLE', 2: 'MANUAL' },
    { hinted: 'animation_mixer.cpp:2471' }
  ),
  callback_mode_method: v.enumInt(
    'callback_mode_method',
    0,
    1,
    { 0: 'DEFERRED', 1: 'IMMEDIATE' },
    { hinted: 'animation_mixer.cpp:2472' }
  ),
  callback_mode_discrete: v.enumInt(
    'callback_mode_discrete',
    0,
    2,
    { 0: 'DOMINANT', 1: 'RECESSIVE', 2: 'FORCE_CONTINUOUS' },
    { hinted: 'animation_mixer.cpp:2473' }
  ),
});
