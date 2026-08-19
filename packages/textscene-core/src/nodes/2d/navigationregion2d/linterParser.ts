/** NavigationRegion2D strict validators for linting (format validation). */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('NavigationRegion2D', {
  navigation_polygon: v.resourceReference('navigation_polygon'),
  // navigation_region_2d.cpp:348 — plain BOOL, no hint.
  enabled: v.boolean('enabled'),
  // navigation_region_2d.cpp:349 — plain BOOL, no hint.
  use_edge_connections: v.boolean('use_edge_connections'),
  // navigation_region_2d.cpp:350 — PROPERTY_HINT_LAYERS_2D_NAVIGATION.
  // set_navigation_layers (:75-83) only short-circuits on an unchanged value,
  // otherwise a bare assignment.
  navigation_layers: layerBitmask('navigation_layers', { hinted: 'navigation_region_2d.cpp:350', width: 'uint32' /* navigation_region_2d.h:94 */ }),
  // navigation_region_2d.cpp:351 declares plain FLOAT with NO
  // PROPERTY_HINT_RANGE, but set_enter_cost (:112) opens with
  // ERR_FAIL_COND_MSG(p_enter_cost < 0.0, ...): an ENFORCED floor.
  enter_cost: v.float('enter_cost', {
    min: 0,
    message: "Property 'enter_cost' must be positive.",
    enforced: 'navigation_region_2d.cpp:112',
  }),
  // navigation_region_2d.cpp:352, set_travel_cost (:127):
  // ERR_FAIL_COND_MSG(p_travel_cost < 0.0, ...), same shape as enter_cost.
  travel_cost: v.float('travel_cost', {
    min: 0,
    message: "Property 'travel_cost' must be positive.",
    enforced: 'navigation_region_2d.cpp:127',
  }),

  // -- Pre-release 4.0 spelling (navigation_region_2d.cpp:358-375) -----------
  // navigation_region_2d.cpp:361 (`_set`) / :369 (`_get`) hand `p_value`
  // straight to set_navigation_polygon, so the slot takes exactly the same
  // reference formats. Named `navpoly` so the diagnostic quotes the key the
  // scene carries.
  navpoly: v.resourceReference('navpoly'),
});
