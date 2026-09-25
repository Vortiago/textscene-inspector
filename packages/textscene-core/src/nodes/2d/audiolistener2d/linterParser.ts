/**
 * AudioListener2D strict validators for linting. The class binds no
 * `ADD_PROPERTY` (`audio_listener_2d.cpp:110` binds three methods), and
 * `doc/classes/AudioListener2D.xml` lists no `<member>`. `current` arrives through
 * the hand-rolled `_set`/`_get`/`_get_property_list` trio (`audio_listener_2d.cpp:35-63`).
 */

// The base chain: registration happens on import, so a test that loads only this
// slice resolves an inherited key only through this line.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('AudioListener2D', {
  // audio_listener_2d.cpp:61-63 pushes PropertyInfo(Variant::BOOL, PNAME("current"))
  // with PROPERTY_USAGE_DEFAULT (STORAGE | EDITOR, object.h). `_set` (:35-46) calls
  // make_current() or clear_current() on the value's truthiness, so any bool is
  // accepted. Camera3D.current has the same shape (camera_3d.cpp:681).
  current: v.boolean('current'),
});
