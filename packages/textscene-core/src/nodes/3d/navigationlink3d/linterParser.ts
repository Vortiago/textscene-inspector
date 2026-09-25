/**
 * NavigationLink3D strict validators for linting: only its own members, the ones
 * doc/classes/NavigationLink3D.xml lists without `overrides=`. The NODE_BASE_TYPES
 * base-walk delivers everything from Node3D up, so re-declaring an inherited key
 * shadows it and duplicates the rule.
 */

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

// `enabled` and `bidirectional` are bare-assignment bools with no hint
// (navigation_link_3d.cpp:307-320, :350-363), so they are format-only.
// A `DISABLE_DEPRECATED` `_set`/`_get` (navigation_link_3d.cpp:221-245) forwards the legacy
// `start_location`/`end_location`, which an older scene still loads, so both register below.
validatorRegistry.registerAll('NavigationLink3D', {
  enabled: v.boolean('enabled'),
  bidirectional: v.boolean('bidirectional'),
  // navigation_link_3d.cpp:214, PROPERTY_HINT_LAYERS_3D_NAVIGATION. The setter (:366-374)
  // is a bare uint32_t assignment, so the hint is the only authority and out-of-range warns.
  navigation_layers: layerBitmask('navigation_layers', { hinted: 'navigation_link_3d.cpp:214', width: 'uint32' /* navigation_link_3d.h:81 */ }),
  // navigation_link_3d.cpp:398-411 and :419-432 are bare assignments with no range hint,
  // so every component is unconstrained, inf and nan included.
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
});
