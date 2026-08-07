/**
 * AudioListener3D strict validators for linting.
 *
 * Declare only AudioListener3D's OWN members — the ones doc/classes/AudioListener3D.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

// audio_listener_3d.h:40-44: `enum DopplerTracking { DOPPLER_TRACKING_DISABLED,
// DOPPLER_TRACKING_IDLE_STEP, DOPPLER_TRACKING_PHYSICS_STEP };` — three members,
// no MAX sentinel, so 2 is the real ceiling (matches Camera3D's own
// doppler_tracking, camera_3d.cpp:679, same enum shape).
const DOPPLER_TRACKING = { 0: 'DISABLED', 1: 'IDLE_STEP', 2: 'PHYSICS_STEP' };

validatorRegistry.registerAll('AudioListener3D', {
  // NOT an ADD_PROPERTY: `current` reaches a .tscn through the hand-rolled
  // _set/_get/_get_property_list trio (audio_listener_3d.cpp:42-72), which
  // pushes PropertyInfo(Variant::BOOL, PNAME("current")) with the default usage
  // STORAGE|EDITOR. So it serialises, and neither the XML nor an ADD_PROPERTY
  // grep can see it. `_set` only branches on the value's truthiness, so any
  // bool is accepted and there is nothing to bound.
  current: v.boolean('current'),
  // audio_listener_3d.cpp:146-158, `set_doppler_tracking` is a bare assignment
  // behind an equality early-return — no ERR_FAIL_INDEX — so an out-of-range
  // value is only hinted (audio_listener_3d.cpp:172's PROPERTY_HINT_ENUM), not
  // enforced: warning, not error.
  doppler_tracking: v.enumInt('doppler_tracking', 0, 2, DOPPLER_TRACKING, {
    hinted: 'audio_listener_3d.cpp:172',
  }),
});
