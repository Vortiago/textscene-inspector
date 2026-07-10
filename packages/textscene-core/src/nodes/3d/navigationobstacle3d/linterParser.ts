/** NavigationObstacle3D strict validators for linting. */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('NavigationObstacle3D', {
  transform: v.transform3d('transform'),
  radius: v.float('radius', { min: 0, message: "Property 'radius' must be >= 0." }),
  height: v.float('height', { min: 0, message: "Property 'height' must be >= 0." }),
  avoidance_enabled: v.boolean('avoidance_enabled'),
  avoidance_layers: v.int('avoidance_layers', {
    min: 0,
    max: 1048575,
    message:
      "Property 'avoidance_layers' must be between 0 and 1048575. Valid range: 20-bit bitmask",
  }),
  affect_navigation_mesh: v.boolean('affect_navigation_mesh'),
  carve_navigation_mesh: v.boolean('carve_navigation_mesh'),
  use_3d_avoidance: v.boolean('use_3d_avoidance'),
});
