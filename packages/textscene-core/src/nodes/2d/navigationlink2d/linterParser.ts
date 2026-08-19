/**
 * NavigationLink2D strict validators for linting.
 *
 * Declare only NavigationLink2D's OWN members — the ones doc/classes/NavigationLink2D.xml
 * lists without an `overrides=` attribute. Everything from Node2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('NavigationLink2D', {
  enabled: v.boolean('enabled'),
  bidirectional: v.boolean('bidirectional'),
  // navigation_link_2d.cpp:75, PROPERTY_HINT_LAYERS_2D_NAVIGATION — a UI-control
  // hint, not a range the setter enforces: set_navigation_layers (:205-213) is a
  // bare assignment with no ERR_FAIL or mask.
  navigation_layers: layerBitmask('navigation_layers', { hinted: 'navigation_link_2d.cpp:75', width: 'uint32' /* navigation_link_2d.h:79 */ }),
  start_position: v.vector2('start_position'),
  end_position: v.vector2('end_position'),
  // navigation_link_2d.cpp:310, ERR_FAIL_COND_MSG(p_enter_cost < 0.0, "The
  // enter_cost must be positive.").
  enter_cost: v.float('enter_cost', {
    min: 0,
    message: "Property 'enter_cost' must be positive.",
    enforced: 'navigation_link_2d.cpp:310',
  }),
  // navigation_link_2d.cpp:321, ERR_FAIL_COND_MSG(p_travel_cost < 0.0, "The
  // travel_cost must be positive.").
  travel_cost: v.float('travel_cost', {
    min: 0,
    message: "Property 'travel_cost' must be positive.",
    enforced: 'navigation_link_2d.cpp:321',
  }),

  // -- Pre-4.0 spellings (navigation_link_2d.cpp:82-106) ---------------------
  // navigation_link_2d.cpp:84 / :88 (`_set`) hand `p_value` straight to
  // set_start_position / set_end_position, so both take the same unconstrained
  // Vector2 the modern keys take. Named for the key the scene carries.
  start_location: v.vector2('start_location'),
  end_location: v.vector2('end_location'),
});
