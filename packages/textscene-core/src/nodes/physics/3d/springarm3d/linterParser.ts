/**
 * SpringArm3D strict validators for linting.
 *
 * Declare only SpringArm3D's OWN members — the ones doc/classes/SpringArm3D.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('SpringArm3D', {
  // scene/3d/physics/spring_arm_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::INT, "collision_mask", PROPERTY_HINT_LAYERS_3D_PHYSICS), ...)
  collision_mask: layerBitmask('collision_mask'),
  // scene/3d/physics/spring_arm_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::OBJECT, "shape", PROPERTY_HINT_RESOURCE_TYPE, "Shape3D"), ...)
  shape: v.resourceReference('shape'),
  // scene/3d/physics/spring_arm_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "spring_length", PROPERTY_HINT_NONE, "suffix:m"), ...) — no PROPERTY_HINT_RANGE, so no bound
  spring_length: v.float('spring_length'),
  // scene/3d/physics/spring_arm_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "margin", PROPERTY_HINT_NONE, "suffix:m"), ...) — no PROPERTY_HINT_RANGE, so no bound
  margin: v.float('margin'),
});
