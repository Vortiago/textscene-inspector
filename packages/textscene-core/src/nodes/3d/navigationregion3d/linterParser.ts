/** NavigationRegion3D strict validators for linting. */

// Registration happens on import, so a test that loads only this slice resolves an
// inherited key only when this line pulls the ancestor in.
import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('NavigationRegion3D', {
  navigation_mesh: v.resourceReference('navigation_mesh'),
  // navigation_region_3d.cpp:299: plain BOOL, no hint.
  enabled: v.boolean('enabled'),
  // navigation_region_3d.cpp:300: plain BOOL, no hint.
  use_edge_connections: v.boolean('use_edge_connections'),
  // navigation_region_3d.cpp:301: PROPERTY_HINT_LAYERS_3D_NAVIGATION.
  // set_navigation_layers (:95-103) is a bare assignment.
  navigation_layers: layerBitmask('navigation_layers', { hinted: 'navigation_region_3d.cpp:301', width: 'uint32' /* navigation_region_3d.h:89 */ }),
  // navigation_region_3d.cpp:302 is a plain FLOAT with no range hint, but set_enter_cost
  // (:132) refuses p_enter_cost < 0.0, so the floor is enforced.
  enter_cost: v.float('enter_cost', {
    min: 0,
    message: "Property 'enter_cost' must be positive.",
    enforced: 'navigation_region_3d.cpp:132',
  }),
  // navigation_region_3d.cpp:303: set_travel_cost (:147) refuses p_travel_cost < 0.0,
  // like enter_cost.
  travel_cost: v.float('travel_cost', {
    min: 0,
    message: "Property 'travel_cost' must be positive.",
    enforced: 'navigation_region_3d.cpp:147',
  }),
});
