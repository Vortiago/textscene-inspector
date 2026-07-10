/** NavigationAgent3D strict validators for linting. */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const LAYER_MSG = (name: string) =>
  `Property '${name}' must be between 0 and 1048575 (got a value out of range). Valid range: 20-bit bitmask`;

// NavigationAgent3D is a plain Node (see nodeBaseTypes.ts) — no spatial
// validators; only the type-specific property surface is registered here.
validatorRegistry.registerAll('NavigationAgent3D', {
  radius: v.float('radius', { min: 0, message: "Property 'radius' must be >= 0." }),
  height: v.float('height', { min: 0, message: "Property 'height' must be >= 0." }),
  avoidance_enabled: v.boolean('avoidance_enabled'),
  avoidance_layers: v.int('avoidance_layers', { min: 0, max: 1048575, message: LAYER_MSG('avoidance_layers') }),
  avoidance_mask: v.int('avoidance_mask', { min: 0, max: 1048575, message: LAYER_MSG('avoidance_mask') }),
  max_neighbors: v.int('max_neighbors', { min: 0, message: "Property 'max_neighbors' must be >= 0." }),
  max_speed: v.float('max_speed', { min: 0, message: "Property 'max_speed' must be >= 0." }),
  navigation_layers: v.int('navigation_layers', { min: 0, max: 1048575, message: LAYER_MSG('navigation_layers') }),
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
