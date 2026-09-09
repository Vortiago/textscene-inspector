/**
 * VoxelGI strict validators for linting.
 *
 * Declare only VoxelGI's OWN members — the ones doc/classes/VoxelGI.xml
 * lists without an `overrides=` attribute. Everything from VisualInstance3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('VoxelGI', {
  // voxel_gi.cpp:570, PROPERTY_HINT_ENUM. The serialised values are the four
  // BIND_ENUM_CONSTANTs SUBDIV_64/128/256/512 (:575-578), i.e. 0-3 — the hint
  // string "64,128,256,512" is that enum's LABELS (the voxel counts), never a
  // numeric range. set_subdiv (:285-288) opens with
  // `ERR_FAIL_INDEX(p_subdiv, SUBDIV_MAX)`, SUBDIV_MAX = 4 (voxel_gi.h:106), so an
  // out-of-range write is refused outright rather than clamped.
  subdiv: v.enumInt(
    'subdiv',
    0,
    3,
    { 0: 'SUBDIV_64', 1: 'SUBDIV_128', 2: 'SUBDIV_256', 3: 'SUBDIV_512' },
    { enforced: 'voxel_gi.cpp:286' }
  ),
  // voxel_gi.cpp:571, PROPERTY_HINT_NONE — no inspector range. set_size
  // (:295-298) assigns `p_size.maxf(1.0)`, which raises any component below
  // 1.0 up to 1.0 (Vector3::maxf, vector3.h:105-107, is a per-axis MAX against
  // the scalar), so the floor is a real alteration and there is no ceiling —
  // `+inf` passes through `maxf` unchanged.
  size: v.boundedVector3('size', { min: 1, enforced: 'voxel_gi.cpp:297' }),
  // voxel_gi.cpp:572, PROPERTY_HINT_RESOURCE_TYPE restricts the inspector to
  // CameraAttributesPractical/CameraAttributesPhysical, but that hint governs
  // the resource picker, not the setter (set_camera_attributes, :305-311, is a
  // bare assignment) — format only, same combinator WorldEnvironment's own
  // camera_attributes uses.
  camera_attributes: v.resourceReference('camera_attributes'),
  // voxel_gi.cpp:573, PROPERTY_HINT_RESOURCE_TYPE "VoxelGIData"; set_probe_data
  // (:269-279) is a bare assignment. Format only — whether the referenced
  // resource exists or is really a VoxelGIData is another rule's job.
  data: v.resourceReference('data'),
});
