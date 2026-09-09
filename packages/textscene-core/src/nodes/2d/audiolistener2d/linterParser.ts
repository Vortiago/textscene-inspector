/**
 * AudioListener2D strict validators for linting.
 *
 * The class binds ZERO `ADD_PROPERTY` (`_bind_methods`,
 * `audio_listener_2d.cpp:110`, binds three methods and nothing else) and
 * `doc/classes/AudioListener2D.xml` lists no `<member>` at all — yet it does
 * serialise one property. `current` arrives through the hand-rolled
 * `_set`/`_get`/`_get_property_list` trio (`audio_listener_2d.cpp:35-63`), the
 * fourth route a property reaches a `.tscn`, and the only one invisible to both
 * an ADD_PROPERTY grep and the class reference.
 *
 * Everything from Node2D up is registered on the ancestor and delivered by the
 * NODE_BASE_TYPES base-walk.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('AudioListener2D', {
  // audio_listener_2d.cpp:61-63 pushes PropertyInfo(Variant::BOOL,
  // PNAME("current")) with no usage argument, so it takes PROPERTY_USAGE_DEFAULT
  // (STORAGE | EDITOR, object.h) and is written whenever it differs from the
  // default `false`. `_set` (:35-46) branches only on the value's truthiness —
  // make_current() or clear_current() — so any bool is accepted and there is no
  // bound to ground. Same shape as AudioListener3D and as Camera3D.current,
  // which Godot declares the ordinary way (camera_3d.cpp:681).
  current: v.boolean('current'),
});
