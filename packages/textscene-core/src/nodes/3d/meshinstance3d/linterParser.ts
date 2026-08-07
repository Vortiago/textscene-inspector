/**
 * MeshInstance3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

// The immediate validator-bearing base, which pulls VisualInstance3D and Node3D
// in turn — the shadow / GI / visibility-range set lives on GeometryInstance3D
// now, so importing a shallower base would leave this module unable to answer
// for keys it is chained to.
import '../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

// Only MeshInstance3D's OWN members. `cast_shadow`, `gi_mode`, the four
// `visibility_range_*` keys, `material_override` and `material_overlay` all
// belong to GeometryInstance3D and reach this type through the base-walk;
// `layers` belongs to VisualInstance3D. `gi_lightmap_scale` is gone entirely —
// scene/3d/visual_instance_3d.cpp binds it PROPERTY_USAGE_NONE and nothing
// restores it, so it is never written to a .tscn and validating it was dead.
//
// `blend_shapes/<name>` is a hand-rolled `_set`/`_get`/`_get_property_list`
// route (mesh_instance_3d.cpp:51-109), resolved WHOLE against
// `blend_shape_properties` rather than by index parsing — the full string
// "blend_shapes/<name>" maps straight to a track index, rebuilt from the Mesh
// resource every time it changes (:413-414). See propertyListRouteCoverage.test.ts.
validatorRegistry.registerAll('MeshInstance3D', {
  mesh: v.resourceReference('mesh'),
  skeleton: v.nodePath('skeleton'),
  skin: v.resourceReference('skin'),
  'surface_material_override/*': v.resourceReference('surface_material_override'),

  // mesh_instance_3d.cpp:102-103, PROPERTY_HINT_RANGE "-1,1,0.00001". The
  // FLOAT type is fixed (get_blend_shape_value/set_blend_shape_value are both
  // typed `float`), but the leaf NAME is dynamic (from the Mesh resource), so
  // a plain wildcard. set_blend_shape_value (:168-173) assigns straight
  // through past two ERR_FAILs that guard the mesh/index, never the value
  // itself, so the hint is a warning, not an error — the trap this row names.
  'blend_shapes/*': v.float('blend_shapes', { min: -1, max: 1, hinted: 'mesh_instance_3d.cpp:103' }),
});
