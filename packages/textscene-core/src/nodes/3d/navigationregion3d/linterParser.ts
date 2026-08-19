/** NavigationRegion3D strict validators for linting (format validation). */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('NavigationRegion3D', {
  navigation_mesh: v.resourceReference('navigation_mesh'),
  // navigation_region_3d.cpp:299 — plain BOOL, no hint.
  enabled: v.boolean('enabled'),
  // navigation_region_3d.cpp:300 — plain BOOL, no hint.
  use_edge_connections: v.boolean('use_edge_connections'),
  // navigation_region_3d.cpp:301 — PROPERTY_HINT_LAYERS_3D_NAVIGATION (the
  // 3D counterpart of NavigationRegion2D's LAYERS_2D_NAVIGATION hint; same
  // verdict, different cited line). set_navigation_layers (:95-103) only
  // short-circuits on an unchanged value, otherwise a bare assignment.
  navigation_layers: layerBitmask('navigation_layers', { hinted: 'navigation_region_3d.cpp:301', width: 'uint32' /* navigation_region_3d.h:89 */ }),
  // navigation_region_3d.cpp:302 declares plain FLOAT with NO
  // PROPERTY_HINT_RANGE, but set_enter_cost (:132) opens with
  // ERR_FAIL_COND_MSG(p_enter_cost < 0.0, ...): an ENFORCED floor.
  enter_cost: v.float('enter_cost', {
    min: 0,
    message: "Property 'enter_cost' must be positive.",
    enforced: 'navigation_region_3d.cpp:132',
  }),
  // navigation_region_3d.cpp:303, set_travel_cost (:147):
  // ERR_FAIL_COND_MSG(p_travel_cost < 0.0, ...), same shape as enter_cost.
  travel_cost: v.float('travel_cost', {
    min: 0,
    message: "Property 'travel_cost' must be positive.",
    enforced: 'navigation_region_3d.cpp:147',
  }),

  // -- Pre-release 4.0 spelling (navigation_region_3d.cpp:309-326) -----------
  // navigation_region_3d.cpp:312 (`_set`) / :320 (`_get`) hand `p_value`
  // straight to set_navigation_mesh, so the slot takes exactly the same
  // reference formats. Named `navmesh` so the diagnostic quotes the key the
  // scene carries.
  navmesh: v.resourceReference('navmesh'),
});
