/**
 * VoxelGI strict validators for its own members, the ones doc/classes/VoxelGI.xml lists without
 * `overrides=`. Keys from VisualInstance3D up arrive through the NODE_BASE_TYPES base-walk, so
 * re-declaring one would shadow the ancestor's rule.
 */

import '../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('VoxelGI', {
  // voxel_gi.cpp:570, PROPERTY_HINT_ENUM over SUBDIV_64/128/256/512 (:575-578), stored as 0-3. The
  // hint string "64,128,256,512" holds the labels, not a range. set_subdiv (:285-288) opens with
  // `ERR_FAIL_INDEX(p_subdiv, SUBDIV_MAX)`, SUBDIV_MAX = 4 (voxel_gi.h:106), so it refuses an
  // out-of-range write.
  subdiv: v.enumInt(
    'subdiv',
    0,
    3,
    { 0: 'SUBDIV_64', 1: 'SUBDIV_128', 2: 'SUBDIV_256', 3: 'SUBDIV_512' },
    { enforced: 'voxel_gi.cpp:286' }
  ),
  // voxel_gi.cpp:571, PROPERTY_HINT_NONE. set_size (:295-298) assigns `p_size.maxf(1.0)`, a per-axis
  // max against the scalar (Vector3::maxf, vector3.h:105-107), so it raises a component below 1.0.
  // There is no ceiling: `+inf` passes through `maxf` unchanged.
  size: v.boundedVector3('size', { min: 1, enforced: 'voxel_gi.cpp:297' }),
  // voxel_gi.cpp:572, PROPERTY_HINT_RESOURCE_TYPE limits the resource picker to
  // CameraAttributesPractical/CameraAttributesPhysical. set_camera_attributes (:305-311) is a bare
  // assignment, so the check is format only.
  camera_attributes: v.resourceReference('camera_attributes'),
  // voxel_gi.cpp:573, PROPERTY_HINT_RESOURCE_TYPE "VoxelGIData". set_probe_data (:269-279) is a bare
  // assignment, so the check is format only. Whether the resource exists, or is a VoxelGIData, is
  // another rule's job.
  data: v.resourceReference('data'),
});
