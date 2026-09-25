/**
 * Node3D strict validators. `scale` is format-only: `Node3D::set_scale` (node_3d.cpp:812-827) is a
 * bare assignment with no zero guard, unlike `Node2D::set_scale` (node_2d.cpp:194-198), which
 * substitutes CMP_EPSILON for a (near-)zero component.
 */

// The terminal tier. Registration happens on import, so a slice test that loads only this chain
// imports `Node` explicitly, or every Node-level key (`process_mode`, `process_priority`,
// `editor_description`) resolves to null in isolation.
import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const ROTATION_ORDER = {
  0: 'XYZ',
  1: 'XZY',
  2: 'YXZ',
  3: 'YZX',
  4: 'ZXY',
  5: 'ZYX',
};

const ROTATION_EDIT_MODE = {
  0: 'Euler',
  1: 'Quaternion',
  2: 'Basis',
};

validatorRegistry.registerAll('Node3D', {
  transform: v.transform3d('transform'),
  global_transform: v.transform3d('global_transform'),
  position: v.vector3('position'),
  rotation: v.vector3('rotation'),
  rotation_degrees: v.vector3('rotation_degrees'),
  scale: v.vector3('scale'),
  quaternion: v.quaternion('quaternion'),
  basis: v.basis('basis'),
  global_position: v.vector3('global_position'),
  global_rotation: v.vector3('global_rotation'),
  global_rotation_degrees: v.vector3('global_rotation_degrees'),
  global_basis: v.basis('global_basis'),
  visible: v.boolean('visible'),
  top_level: v.boolean('top_level'),
  visibility_parent: v.nodePath('visibility_parent'),
  // node_3d.cpp:759, ERR_FAIL_INDEX(int32_t(p_order), 6).
  rotation_order: v.enumInt('rotation_order', 0, 5, ROTATION_ORDER, {
    enforced: 'node_3d.cpp:759',
  }),
  // node_3d.cpp:1532, PROPERTY_HINT_ENUM "Euler,Quaternion,Basis". Unlike
  // rotation_order's neighbouring ERR_FAIL_INDEX, set_rotation_edit_mode
  // (node_3d.cpp:717-746) has no range guard at all, so out-of-range is
  // hinted only.
  rotation_edit_mode: v.enumInt('rotation_edit_mode', 0, 2, ROTATION_EDIT_MODE, {
    hinted: 'node_3d.cpp:1532',
  }),
});
