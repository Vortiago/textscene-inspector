/**
 * SpringArm3D strict validators. Declare only its own members, the ones
 * doc/classes/SpringArm3D.xml lists without `overrides=`: the NODE_BASE_TYPES
 * base-walk delivers Node3D's, and a re-declared key shadows it.
 */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('SpringArm3D', {
  // scene/3d/physics/spring_arm_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::INT, "collision_mask", PROPERTY_HINT_LAYERS_3D_PHYSICS), ...)
  collision_mask: layerBitmask('collision_mask', { hinted: 'spring_arm_3d.cpp:75', width: 'uint32' /* spring_arm_3d.h:55 */ }),
  // scene/3d/physics/spring_arm_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::OBJECT, "shape", PROPERTY_HINT_RESOURCE_TYPE, "Shape3D"), ...)
  shape: v.resourceReference('shape'),
  // scene/3d/physics/spring_arm_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "spring_length", PROPERTY_HINT_NONE, "suffix:m"), ...), so no bound
  spring_length: v.float('spring_length'),
  // scene/3d/physics/spring_arm_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "margin", PROPERTY_HINT_NONE, "suffix:m"), ...), so no bound
  margin: v.float('margin'),
});
