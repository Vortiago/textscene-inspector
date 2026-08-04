/** NavigationObstacle3D strict validators for linting. */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

// Spatial validators (transform/position/...) are inherited from Node3D via
// the nodeBaseTypes chain — only the type-specific surface is registered here.
validatorRegistry.registerAll('NavigationObstacle3D', {
  // navigation_obstacle_3d.cpp:308, ERR_FAIL_COND_MSG(p_radius < 0.0, ...).
  radius: v.float('radius', {
    min: 0,
    message: "Property 'radius' must be >= 0.",
    enforced: 'navigation_obstacle_3d.cpp:308',
  }),
  // navigation_obstacle_3d.cpp:326, ERR_FAIL_COND_MSG(p_height < 0.0, ...).
  height: v.float('height', {
    min: 0,
    message: "Property 'height' must be >= 0.",
    enforced: 'navigation_obstacle_3d.cpp:326',
  }),
  avoidance_enabled: v.boolean('avoidance_enabled'),
  // Bare uint32_t assignment (:341): the parameter type is the ceiling.
  avoidance_layers: layerBitmask('avoidance_layers', { hinted: 'navigation_obstacle_3d.cpp:86' }),
  affect_navigation_mesh: v.boolean('affect_navigation_mesh'),
  carve_navigation_mesh: v.boolean('carve_navigation_mesh'),
  use_3d_avoidance: v.boolean('use_3d_avoidance'),
});
