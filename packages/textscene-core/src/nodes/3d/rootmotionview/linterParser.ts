/**
 * RootMotionView strict validators: only its own members, which doc/classes/RootMotionView.xml lists
 * without `overrides=`. The NODE_BASE_TYPES base-walk delivers VisualInstance3D and up, and a
 * re-declared inherited key shadows it. All five ADD_PROPERTY calls (root_motion_view.cpp:189-193)
 * serialise, and root_motion_view.h has no `_get`/`_set`/`get_property_list` or `ADD_ARRAY_COUNT`.
 */

import '../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('RootMotionView', {
  // root_motion_view.cpp:189, PROPERTY_HINT_NODE_PATH_VALID_TYPES "AnimationMixer", which narrows
  // only the editor's picker. A missing or wrong-type target is invisible without the live tree,
  // and set_animation_mixer (root_motion_view.cpp:38-41) assigns with no validation, so only the
  // NodePath grammar is checked.
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
