/** NavigationObstacle3D strict validators for linting. */

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

// The nodeBaseTypes chain delivers the Node3D validators, so only this type's own
// members register here.
validatorRegistry.registerAll('NavigationObstacle3D', {
  // navigation_obstacle_3d.cpp:77, PROPERTY_HINT_RANGE "0.0,100,0.01,suffix:m". :308
  // refuses p_radius < 0.0, but the setter never checks the 100 ceiling, so it is hinted.
  radius: v.float('radius', {
    min: 0,
    max: 100,
    enforced: { min: 'navigation_obstacle_3d.cpp:308' },
    hinted: { max: 'navigation_obstacle_3d.cpp:77' },
  }),
  // navigation_obstacle_3d.cpp:78, the same split as radius: :326 refuses
  // p_height < 0.0, and the 100 ceiling is hint-only.
  height: v.float('height', {
    min: 0,
    max: 100,
    enforced: { min: 'navigation_obstacle_3d.cpp:326' },
    hinted: { max: 'navigation_obstacle_3d.cpp:78' },
  }),
  // navigation_obstacle_3d.cpp:79. get_vertices (.h:102) returns `const Vector<Vector3> &`,
  // not a TypedArray, so it serialises as PackedVector3Array(...). set_vertices (:263)
  // only recomputes debug flags, with no guard.
  vertices: v.packedVector3Array('vertices'),
  avoidance_enabled: v.boolean('avoidance_enabled'),
  // Bare uint32_t assignment (:341): the parameter type is the ceiling.
  avoidance_layers: layerBitmask('avoidance_layers', { hinted: 'navigation_obstacle_3d.cpp:86', width: 'uint32' /* navigation_obstacle_3d.h:107 */ }),
  affect_navigation_mesh: v.boolean('affect_navigation_mesh'),
  carve_navigation_mesh: v.boolean('carve_navigation_mesh'),
  use_3d_avoidance: v.boolean('use_3d_avoidance'),
  // navigation_obstacle_3d.cpp:85, PROPERTY_USAGE_NO_EDITOR includes
  // PROPERTY_USAGE_STORAGE (object.h:132), so it serialises. set_velocity (:387)
  // assigns with no bound.
  velocity: v.vector3('velocity'),
});
