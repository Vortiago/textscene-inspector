/**
 * RootMotionView strict validators for linting.
 *
 * Declare only RootMotionView's OWN members — the ones doc/classes/RootMotionView.xml
 * lists without an `overrides=` attribute. Everything from VisualInstance3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * All five of RootMotionView's own ADD_PROPERTY calls sit in one block
 * (root_motion_view.cpp:189-193), each with a non-empty setter and getter, so
 * every one of them serialises. root_motion_view.h declares no `_get`/`_set`/
 * `get_property_list` override and no `ADD_ARRAY_COUNT`, so ADD_PROPERTY is the
 * only route a member takes here — nothing else to grep for.
 */

import '../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('RootMotionView', {
  // root_motion_view.cpp:189, PROPERTY_HINT_NODE_PATH_VALID_TYPES "AnimationMixer".
  // The hint narrows the editor's node-path PICKER to AnimationMixer subclasses;
  // it names no format or range this linter can check statically (a target that
  // is missing, or the wrong type, is invisible without the live tree — see
  // "Linter can't see instance internals"). set_animation_mixer
  // (root_motion_view.cpp:38-41) assigns straight through with no validation,
  // so only the NodePath grammar itself is checked here.
  animation_path: v.nodePath('animation_path'),
  // root_motion_view.cpp:190, PROPERTY_HINT_NONE (no hint argument at all).
  // set_color (root_motion_view.cpp:47-50) assigns straight through with no
  // clamp, so an HDR component outside 0-1 is legal, not a bound to enforce.
  color: v.color('color'),
  // root_motion_view.cpp:191, PROPERTY_HINT_RANGE "0.1,16,0.01,or_greater,suffix:m".
  // `or_greater` opens the max end, so 16 is not a ceiling. set_cell_size
  // (root_motion_view.cpp:56-59) assigns straight through with no clamp, so the
  // 0.1 floor is merely hinted (warning), not enforced (error).
  cell_size: v.float('cell_size', { min: 0.1, hinted: 'root_motion_view.cpp:191' }),
  // root_motion_view.cpp:192, PROPERTY_HINT_RANGE "0.1,16,0.01,or_greater,suffix:m",
  // the same shape as cell_size. set_radius (root_motion_view.cpp:65-68) assigns
  // straight through with no clamp, so the 0.1 floor is hinted, not enforced.
  radius: v.float('radius', { min: 0.1, hinted: 'root_motion_view.cpp:192' }),
  // root_motion_view.cpp:193, PROPERTY_HINT_NONE. set_zero_y
  // (root_motion_view.cpp:74-76) assigns straight through with no guard, so
  // this is a format check only.
  zero_y: v.boolean('zero_y'),
});
