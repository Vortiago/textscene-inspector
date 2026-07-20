/** NavigationAgent3D strict validators for linting. */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

// NavigationAgent3D is a plain Node (see nodeBaseTypes.ts) — no spatial
// validators; only the type-specific property surface is registered here.
validatorRegistry.registerAll('NavigationAgent3D', {
  radius: v.float('radius', { min: 0, message: "Property 'radius' must be >= 0." }),
  height: v.float('height', { min: 0, message: "Property 'height' must be >= 0." }),
  avoidance_enabled: v.boolean('avoidance_enabled'),
  avoidance_layers: layerBitmask('avoidance_layers'),
  avoidance_mask: layerBitmask('avoidance_mask'),
  max_neighbors: v.int('max_neighbors', { min: 0, message: "Property 'max_neighbors' must be >= 0." }),
  max_speed: v.float('max_speed', { min: 0, message: "Property 'max_speed' must be >= 0." }),
  navigation_layers: layerBitmask('navigation_layers'),
  target_desired_distance: v.float('target_desired_distance', {
    min: 0,
    message: "Property 'target_desired_distance' must be >= 0.",
  }),
  path_desired_distance: v.float('path_desired_distance', {
    min: 0,
    message: "Property 'path_desired_distance' must be >= 0.",
  }),
  target_position: v.vector3('target_position'),
});
