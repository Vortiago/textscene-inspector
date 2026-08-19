/**
 * NavigationLink3D strict validators for linting.
 *
 * Declare only NavigationLink3D's OWN members — the ones doc/classes/NavigationLink3D.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `enabled` and `bidirectional` are bare-assignment bools (navigation_link_3d.cpp:307-320,
 * :350-363): no ERR_FAIL, no PROPERTY_HINT, so `v.boolean` (format only).
 *
 * A hand-rolled `_set`/`_get` (navigation_link_3d.cpp:221-245, both `#ifndef
 * DISABLE_DEPRECATED`) maps the legacy keys `start_location`/`end_location` to
 * `start_position`/`end_position`, forwarding `p_value` untouched. Neither has
 * an `ADD_PROPERTY` of its own and neither is in the current XML member list,
 * but a scene saved by an older Godot still loads through them, so both
 * register at the bottom of the map under their own names.
 */

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('NavigationLink3D', {
  enabled: v.boolean('enabled'),
  bidirectional: v.boolean('bidirectional'),
  // navigation_link_3d.cpp:214, PROPERTY_HINT_LAYERS_3D_NAVIGATION. The setter
  // (:366-374) is a bare uint32_t assignment — no masking, no ERR_FAIL — so the
  // hint is the only authority and an out-of-range value is a warning.
  navigation_layers: layerBitmask('navigation_layers', { hinted: 'navigation_link_3d.cpp:214', width: 'uint32' /* navigation_link_3d.h:81 */ }),
  // navigation_link_3d.cpp:398-411 and :419-432: bare assignment (only an
  // equal-check early return), no PROPERTY_HINT_RANGE on the VECTOR3 — every
  // component is unconstrained, inf/nan included.
  start_position: v.vector3('start_position'),
  end_position: v.vector3('end_position'),
  // navigation_link_3d.cpp:473, ERR_FAIL_COND_MSG(p_enter_cost < 0.0, ...).
  enter_cost: v.float('enter_cost', {
    min: 0,
    message: "Property 'enter_cost' must be >= 0.",
    enforced: 'navigation_link_3d.cpp:473',
  }),
  // navigation_link_3d.cpp:484, ERR_FAIL_COND_MSG(p_travel_cost < 0.0, ...).
  travel_cost: v.float('travel_cost', {
    min: 0,
    message: "Property 'travel_cost' must be >= 0.",
    enforced: 'navigation_link_3d.cpp:484',
  }),

  // -- Pre-4.0 spellings (navigation_link_3d.cpp:221-245) --------------------
  // navigation_link_3d.cpp:223 / :227 (`_set`) hand `p_value` straight to
  // set_start_position / set_end_position, so both take the same unconstrained
  // Vector3 the modern keys take. Named for the key the scene carries.
  start_location: v.vector3('start_location'),
  end_location: v.vector3('end_location'),
});
