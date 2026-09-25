/** MeshInstance3D strict validators for linting. */

// The nearest validator-bearing base, which pulls in VisualInstance3D and Node3D. The
// shadow, GI and visibility-range keys live on GeometryInstance3D, so a shallower base
// would leave this module unable to answer for them.
import '../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

// Only MeshInstance3D's own members: the base-walk delivers the GeometryInstance3D and
// VisualInstance3D keys. `gi_lightmap_scale` is bound PROPERTY_USAGE_NONE
// (scene/3d/visual_instance_3d.cpp), so it never reaches a .tscn and gets no validator.
validatorRegistry.registerAll('MeshInstance3D', {
  mesh: v.resourceReference('mesh'),
  skeleton: v.nodePath('skeleton'),
  skin: v.resourceReference('skin'),
  'surface_material_override/*': v.resourceReference('surface_material_override'),

  // `blend_shapes/<name>` is a hand-rolled route (mesh_instance_3d.cpp:51-109) keyed on a
  // track the Mesh rebuilds on each change (:413-414), so the leaf is a wildcard. The hint
  // "-1,1,0.00001" (mesh_instance_3d.cpp:102-103) warns: set_blend_shape_value (:168-173)
  // guards only the mesh and the index. See propertyListRouteCoverage.test.ts.
  'blend_shapes/*': v.float('blend_shapes', { min: -1, max: 1, hinted: 'mesh_instance_3d.cpp:103' }),
});
