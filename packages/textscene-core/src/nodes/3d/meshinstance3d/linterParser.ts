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
validatorRegistry.registerAll('MeshInstance3D', {
  mesh: v.resourceReference('mesh'),
  skeleton: v.nodePath('skeleton'),
  skin: v.resourceReference('skin'),
  'surface_material_override/*': v.resourceReference('surface_material_override'),
});
