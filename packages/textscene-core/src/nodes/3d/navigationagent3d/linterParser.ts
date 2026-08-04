/** NavigationAgent3D strict validators for linting. */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

// NavigationAgent3D is a plain Node (see nodeBaseTypes.ts) — no spatial
// validators; only the type-specific property surface is registered here.
validatorRegistry.registerAll('NavigationAgent3D', {
  // navigation_agent_3d.cpp:608, ERR_FAIL_COND_MSG(p_radius < 0.0, ...).
  radius: v.float('radius', {
    min: 0,
    message: "Property 'radius' must be >= 0.",
    enforced: 'navigation_agent_3d.cpp:608',
  }),
  // navigation_agent_3d.cpp:618, ERR_FAIL_COND_MSG(p_height < 0.0, ...).
  height: v.float('height', {
    min: 0,
    message: "Property 'height' must be >= 0.",
    enforced: 'navigation_agent_3d.cpp:618',
  }),
  avoidance_enabled: v.boolean('avoidance_enabled'),
  // Bare uint32_t assignment: the parameter type is the ceiling.
  avoidance_layers: layerBitmask('avoidance_layers', { hinted: 'navigation_agent_3d.cpp:182' }),
  avoidance_mask: layerBitmask('avoidance_mask', { hinted: 'navigation_agent_3d.cpp:183' }),
  // navigation_agent_3d.cpp:655-663 is a bare assignment (only an equal-check
  // early return); the hint at :176 ("1,10000,1,or_greater") gives the real
  // floor of 1, not 0.
  max_neighbors: v.int('max_neighbors', {
    min: 1,
    message: "Property 'max_neighbors' must be >= 1.",
    hinted: 'navigation_agent_3d.cpp:176',
  }),
  // navigation_agent_3d.cpp:684, ERR_FAIL_COND_MSG(p_max_speed < 0.0, ...).
  max_speed: v.float('max_speed', {
    min: 0,
    message: "Property 'max_speed' must be >= 0.",
    enforced: 'navigation_agent_3d.cpp:684',
  }),
  navigation_layers: layerBitmask('navigation_layers', { hinted: 'navigation_agent_3d.cpp:159' }),
  // navigation_agent_3d.cpp:591-596 is a bare assignment; the hint at :156
  // ("0.1,100,0.01,or_greater") gives the real floor of 0.1, not 0.
  target_desired_distance: v.float('target_desired_distance', {
    min: 0.1,
    message: "Property 'target_desired_distance' must be >= 0.1.",
    hinted: 'navigation_agent_3d.cpp:156',
  }),
  // navigation_agent_3d.cpp:599-604 is a bare assignment; the hint at :155
  // ("0.1,100,0.01,or_greater") gives the real floor of 0.1, not 0.
  path_desired_distance: v.float('path_desired_distance', {
    min: 0.1,
    message: "Property 'path_desired_distance' must be >= 0.1.",
    hinted: 'navigation_agent_3d.cpp:155',
  }),
  target_position: v.vector3('target_position'),
});
