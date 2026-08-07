/**
 * AnimationMixer strict validators for linting.
 *
 * Registered under the abstract key 'AnimationMixer' — the shared base of
 * AnimationPlayer and AnimationTree — the same shared-tier shape
 * `canvasitem/shared/linterParser.ts` uses for CanvasItem. Godot cannot
 * instantiate AnimationMixer, so it owns no node slice of its own (no
 * parser.ts, no Component.tsx): just the validators every concrete descendant
 * inherits through the NODE_BASE_TYPES base-walk.
 *
 * This file covers ONLY the three hand-rolled `_set`/`_get` keys
 * (animation_mixer.cpp:55-134) — none of them `ADD_PROPERTY`-declared, none
 * XML-documented, all invisible to the ordinary ADD_PROPERTY/XML sweep:
 *
 * - `anims/<name>` and bare `libraries` are both `#ifndef DISABLE_DEPRECATED`
 *   3.x-compat routes (:58-81, compiled in by default). Neither is ever pushed
 *   by `_get_property_list`, so only a legacy or hand-authored scene reaches
 *   them.
 * - `libraries/<name>` is Godot 4's own live route: `_get_libraries_property_usage`
 *   returns `PROPERTY_USAGE_STORAGE` unconditionally on this class (:125-127),
 *   so every declared library reaches every real `.tscn` through this key.
 *   (`AnimationTree` overrides that usage to add `PROPERTY_USAGE_READ_ONLY`
 *   once an `anim_player` is set, but that only hides the key from the
 *   inspector — the VALUE shape this file checks is unaffected.)
 *
 * AnimationMixer's own TEN `ADD_PROPERTY` members (`active`, `deterministic`,
 * `root_motion_track`, …) are a separate, larger, still-open gap tracked by
 * `ownValidatorCoverage.test.ts` — see its own comment. Closing that needs the
 * ordinary ADD_PROPERTY sweep, not the hand-rolled-route reading this file
 * does, and is out of this file's scope.
 */

import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { accepts, propertyError, v } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

/**
 * `{ "name": SubResource/ExtResource(...), ... }` — the whole animation-library
 * set replaced at once (animation_mixer.cpp:72-81). Format-only, the same
 * Dictionary-literal shape check `GraphEdit.type_names` uses
 * (nodes/2d/ui/graphedit/linterParser.ts): entries are not individually walked,
 * since a malformed one only drops that one library
 * (`add_animation_library`'s own `ERR_FAIL_COND_V`s, animation_mixer.cpp:305)
 * rather than the whole property, and this is a legacy compat key a real
 * Godot export never writes in the first place.
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

validatorRegistry.registerAll('AnimationMixer', {
  // animation_mixer.cpp:58-71, #ifndef DISABLE_DEPRECATED (on by default): a
  // 3.x scene's `anims/Walk = SubResource(...)` reads an Animation resource
  // straight into the default (unnamed) library.
  'anims/*': v.resourceReference('anims'),

  // animation_mixer.cpp:72-81, same guard: the whole library set as one
  // Dictionary, key = library name (possibly "" for the default library),
  // value = an AnimationLibrary reference.
  libraries: librariesValidator,

  // animation_mixer.cpp:129-134 (_get_property_list) / 82-99 (_set) / 111-117
  // (_get): PROPERTY_HINT_RESOURCE_TYPE "AnimationLibrary", always
  // storage-bearing per _get_libraries_property_usage (:125-127).
  'libraries/*': v.resourceReference('libraries'),

  // AnimationMixer's ten ORDINARY members (animation_mixer.cpp:2458-2473).
  //
  // They belong here rather than on AnimationPlayer and AnimationTree
  // separately: both inherit them, and the base-walk reaches both. Declaring
  // them also keeps `ownValidatorCoverage`'s ratchet honest — that guard counts
  // types with ZERO own validators, so registering only the property-list keys
  // above would have taken AnimationMixer off its list while leaving these ten
  // unchecked, tightening the number without closing the gap.
  active: v.boolean('active'),
  deterministic: v.boolean('deterministic'),
  reset_on_save: v.boolean('reset_on_save'),
  root_node: v.nodePath('root_node'),
  root_motion_track: v.nodePath('root_motion_track'),
  root_motion_local: v.boolean('root_motion_local'),
  // animation_mixer.cpp:542 `ERR_FAIL_COND(p < 0 || p > 128)` — the SETTER's
  // band, which is wider than the `1,127,1` hint at :2468. The enforced ends
  // are what a value is refused for, so they are what is checked; a value of 0
  // or 128 clears the setter while sitting outside the inspector's hint, and
  // the DSL has no way to carry a second, narrower warning band on one end.
  audio_max_polyphony: v.int('audio_max_polyphony', {
    min: 0,
    max: 128,
    enforced: 'animation_mixer.cpp:542',
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
