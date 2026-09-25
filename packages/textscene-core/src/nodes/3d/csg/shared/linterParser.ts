/**
 * Validators shared by every CSGShape3D-derived node: the primitives and the combiner. The
 * abstract key 'CSGShape3D' is in no .tscn, since Godot cannot instantiate it, and reaches its
 * subclasses through the NODE_BASE_TYPES base-walk. The primitives reach it through the
 * CSGPrimitive3D tier, and the combiner imports it directly.
 */

import '../../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../linter/validators/index.js';

const OPERATION = { 0: 'UNION', 1: 'INTERSECTION', 2: 'SUBTRACTION' };

validatorRegistry.registerAll('CSGShape3D', {
  // csg_shape.cpp:1040 hints "Union,Intersection,Subtraction";
  // set_operation:933-937 is a bare assignment.
  operation: v.enumInt('operation', 0, 2, OPERATION, { hinted: 'csg_shape.cpp:1040' }),
  // csg_shape.cpp:1044; set_calculate_tangents:943-946 is a bare assignment.
  calculate_tangents: v.boolean('calculate_tangents'),
  // csg_shape.cpp:1048; set_use_collision:85-95 assigns and rebuilds.
  use_collision: v.boolean('use_collision'),
  // csg_shape.cpp:1049-1050, PROPERTY_HINT_LAYERS_3D_PHYSICS. The setters
  // (:120-125, :131-136) store the uint32_t (csg_shape.h:72-73) unguarded.
  collision_layer: layerBitmask('collision_layer', { hinted: 'csg_shape.cpp:1049', width: 'uint32' }),
  collision_mask: layerBitmask('collision_mask', { hinted: 'csg_shape.cpp:1050', width: 'uint32' }),
  // csg_shape.cpp:1051, a plain FLOAT with no hint; set_collision_priority:188-193
  // is a bare assignment.
  collision_priority: v.float('collision_priority'),
});
