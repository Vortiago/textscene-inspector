/**
 * XROrigin3D strict validators for linting.
 *
 * Declare only XROrigin3D's OWN members — the ones doc/classes/XROrigin3D.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('XROrigin3D', {
  // xr_nodes.cpp:729-734 XROrigin3D::set_world_scale forwards unconditionally to
  // XRServer::set_world_scale, which CLAMPS rather than assigning straight
  // through. Both ends are the SETTER's, not a hint's: xr_nodes.cpp:714 declares
  // the property with no hint at all, and `min`/`max` are the slots the sheet
  // and the parity gate read as the hint's numbers.
  world_scale: v.float('world_scale', {
    enforcedMin: { at: 0.01 },
    enforcedMax: { at: 1000 },
    enforced: { min: 'xr_server.cpp:126', max: 'xr_server.cpp:128' },
  }),
  // xr_nodes.cpp:718 ADD_PROPERTY(PropertyInfo(Variant::BOOL, "current"), "set_current", "is_current")
  current: v.boolean('current'),
});
