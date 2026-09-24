/**
 * ImporterMeshInstance3D strict validators: every member doc/classes/ImporterMeshInstance3D.xml
 * lists, none with `overrides=`. The class inherits plain Node3D, so `cast_shadow`,
 * `layer_mask` and `visibility_range_*` are its own ADD_PROPERTY calls (importer_mesh_instance_3d.cpp:
 * 164-176). `set_surface_material` binds no property, so no key reaches a `.tscn`.
 */

import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v, layerBitmask } from '../../../linter/validators/index.js';

/** `GeometryInstance3D::ShadowCastingSetting`, reused by name in this class's own hint string. */
const CAST_SHADOW = { 0: 'OFF', 1: 'ON', 2: 'DOUBLE_SIDED', 3: 'SHADOWS_ONLY' };
/** `GeometryInstance3D::VisibilityRangeFadeMode`, reused by name in this class's own hint string. */
const VISIBILITY_RANGE_FADE_MODE = { 0: 'DISABLED', 1: 'SELF', 2: 'DEPENDENCIES' };

validatorRegistry.registerAll('ImporterMeshInstance3D', {
  // importer_mesh_instance_3d.cpp:164, PROPERTY_HINT_RESOURCE_TYPE "ImporterMesh".
  // set_mesh (:35-37) is a bare Ref<> assignment.
  mesh: v.resourceReference('mesh'),
  // importer_mesh_instance_3d.cpp:165, PROPERTY_HINT_RESOURCE_TYPE "Skin".
  // set_skin (:42-44) is a bare Ref<> assignment.
  skin: v.resourceReference('skin'),
  // importer_mesh_instance_3d.cpp:166, PROPERTY_HINT_NODE_PATH_VALID_TYPES
  // "Skeleton": a filter on the inspector's node picker, not on the stored
  // value. set_skeleton_path (:65-67) is a bare assignment.
  skeleton_path: v.nodePath('skeleton_path'),
  // importer_mesh_instance_3d.cpp:167, PROPERTY_HINT_LAYERS_3D_RENDER.
  // set_layer_mask (:76-78) is a bare uint32 assignment, so a bit outside the
  // 32-bit widget the hint renders is only ever a warning.
  layer_mask: layerBitmask('layer_mask', { hinted: 'importer_mesh_instance_3d.cpp:167', width: 'uint32' /* importer_mesh_instance_3d.h:70 */ }),
  // importer_mesh_instance_3d.cpp:169, PROPERTY_HINT_ENUM "Off,On,Double-Sided,
  // Shadows Only". set_cast_shadows_setting (:80-82) is a bare assignment.
  cast_shadow: v.enumInt('cast_shadow', 0, 3, CAST_SHADOW, {
    hinted: 'importer_mesh_instance_3d.cpp:169',
  }),
  // importer_mesh_instance_3d.cpp:172, PROPERTY_HINT_RANGE
  // "0.0,4096.0,0.01,or_greater,suffix:m". `or_greater`: no cap.
  // set_visibility_range_begin (:88-91) is a bare assignment.
  visibility_range_begin: v.nonNegativeFloat('visibility_range_begin', {
    hinted: 'importer_mesh_instance_3d.cpp:172',
  }),
  // importer_mesh_instance_3d.cpp:173, same hint shape as visibility_range_begin.
  // set_visibility_range_begin_margin (:106-109) is a bare assignment.
  visibility_range_begin_margin: v.nonNegativeFloat('visibility_range_begin_margin', {
    hinted: 'importer_mesh_instance_3d.cpp:173',
  }),
  // importer_mesh_instance_3d.cpp:174, same hint shape as visibility_range_begin.
  // set_visibility_range_end (:97-100) is a bare assignment.
  visibility_range_end: v.nonNegativeFloat('visibility_range_end', {
    hinted: 'importer_mesh_instance_3d.cpp:174',
  }),
  // importer_mesh_instance_3d.cpp:175, same hint shape as visibility_range_begin.
  // set_visibility_range_end_margin (:115-118) is a bare assignment.
  visibility_range_end_margin: v.nonNegativeFloat('visibility_range_end_margin', {
    hinted: 'importer_mesh_instance_3d.cpp:175',
  }),
  // importer_mesh_instance_3d.cpp:176, PROPERTY_HINT_ENUM "Disabled,Self,
  // Dependencies". set_visibility_range_fade_mode (:124-127) is a bare assignment.
  visibility_range_fade_mode: v.enumInt(
    'visibility_range_fade_mode',
    0,
    2,
    VISIBILITY_RANGE_FADE_MODE,
    { hinted: 'importer_mesh_instance_3d.cpp:176' }
  ),
});
