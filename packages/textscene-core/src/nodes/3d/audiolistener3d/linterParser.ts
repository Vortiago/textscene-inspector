/**
 * AudioListener3D strict validators: only the members doc/classes/AudioListener3D.xml lists
 * without an `overrides=` attribute. The NODE_BASE_TYPES base-walk delivers
 * everything from Node3D up, so re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { DOPPLER_TRACKING_NAMES } from '../../../godot/scene/audio.js';

validatorRegistry.registerAll('AudioListener3D', {
  // Not an ADD_PROPERTY: the hand-rolled _set/_get/_get_property_list trio
  // (audio_listener_3d.cpp:42-72) pushes PropertyInfo(Variant::BOOL, PNAME("current")) with the
  // default usage STORAGE|EDITOR, so it serialises unseen by the XML. `_set` only branches on
  // truthiness, so there is nothing to bound.
  current: v.boolean('current'),
  // audio_listener_3d.cpp:146-158, `set_doppler_tracking` is a bare assignment behind an
  // equality early-return, with no ERR_FAIL_INDEX, so an out-of-range value is only hinted
  // (audio_listener_3d.cpp:172's PROPERTY_HINT_ENUM): a warning, not an error.
  doppler_tracking: v.enumInt('doppler_tracking', DOPPLER_TRACKING_NAMES, {
    hinted: 'audio_listener_3d.cpp:172',
  }),
});
