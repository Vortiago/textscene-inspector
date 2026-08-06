/** NavigationObstacle3D strict validators for linting. */

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

// Spatial validators (transform/position/...) are inherited from Node3D via
// the nodeBaseTypes chain — only the type-specific surface is registered here.
validatorRegistry.registerAll('NavigationObstacle3D', {
  // navigation_obstacle_3d.cpp:77, PROPERTY_HINT_RANGE "0.0,100,0.01,suffix:m",
  // a CLOSED max with no or_greater. :308 ERR_FAIL_COND_MSG(p_radius < 0.0,
  // ...) enforces the floor; the setter never checks the 100 ceiling, so it is
  // only a hint.
  radius: v.float('radius', {
    min: 0,
    max: 100,
    enforced: { min: 'navigation_obstacle_3d.cpp:308' },
    hinted: { max: 'navigation_obstacle_3d.cpp:77' },
  }),
  // navigation_obstacle_3d.cpp:78, same closed-max split as radius: :326
  // ERR_FAIL_COND_MSG(p_height < 0.0, ...) enforces the floor, the 100
  // ceiling is hint-only.
  height: v.float('height', {
    min: 0,
    max: 100,
    enforced: { min: 'navigation_obstacle_3d.cpp:326' },
    hinted: { max: 'navigation_obstacle_3d.cpp:78' },
  }),
  // navigation_obstacle_3d.cpp:79, PACKED_VECTOR3_ARRAY. get_vertices (.h:102)
  // returns a plain `const Vector<Vector3> &`, not a TypedArray, so it
  // serialises as PackedVector3Array(...), not Array[Vector3]([...]).
  // set_vertices (:263) only recomputes the clockwise/valid debug flags — no
  // format or range guard.
  vertices: v.packedVector3Array('vertices'),
  avoidance_enabled: v.boolean('avoidance_enabled'),
  // Bare uint32_t assignment (:341): the parameter type is the ceiling.
  avoidance_layers: layerBitmask('avoidance_layers', { hinted: 'navigation_obstacle_3d.cpp:86' }),
  affect_navigation_mesh: v.boolean('affect_navigation_mesh'),
  carve_navigation_mesh: v.boolean('carve_navigation_mesh'),
  use_3d_avoidance: v.boolean('use_3d_avoidance'),
  // navigation_obstacle_3d.cpp:85, PROPERTY_USAGE_NO_EDITOR is ALSO
  // PROPERTY_USAGE_STORAGE (object.h:132): hidden from the inspector but
  // still serialised. set_velocity (:387) assigns straight through, no bound.
  velocity: v.vector3('velocity'),
});
