/** NavigationObstacle3D strict validators for linting. */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

// Spatial validators (transform/position/...) are inherited from Node3D via
// the nodeBaseTypes chain — only the type-specific surface is registered here.
validatorRegistry.registerAll('NavigationObstacle3D', {
  radius: v.float('radius', { min: 0, message: "Property 'radius' must be >= 0." }),
  height: v.float('height', { min: 0, message: "Property 'height' must be >= 0." }),
  avoidance_enabled: v.boolean('avoidance_enabled'),
  avoidance_layers: layerBitmask('avoidance_layers'),
  affect_navigation_mesh: v.boolean('affect_navigation_mesh'),
  carve_navigation_mesh: v.boolean('carve_navigation_mesh'),
  use_3d_avoidance: v.boolean('use_3d_avoidance'),
});
