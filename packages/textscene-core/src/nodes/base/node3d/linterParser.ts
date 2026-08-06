/**
 * Node3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `scale` used to keep a bespoke validator rejecting a zero component, mirroring
 * Node2D. Unlike `Node2D::set_scale` (node_2d.cpp:194-198, which substitutes
 * CMP_EPSILON for a (near-)zero component), `Node3D::set_scale` (node_3d.cpp:812-827)
 * is a bare assignment with no zero guard at all: the previous check was a
 * false positive, so `scale` is now format-only like every other Vector3 here.
 */

// The terminal tier. Registration is self-registering on import, so a slice test
// that loads only this chain must pull `Node` explicitly or every Node-level key
// (`process_mode`, `process_priority`, the `editor_description`) resolves to null
// in isolation and only the full barrel sees them.
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
  // node_3d.cpp:760, ERR_FAIL_INDEX(int32_t(p_order), 6).
  rotation_order: v.enumInt('rotation_order', 0, 5, ROTATION_ORDER, {
    enforced: 'node_3d.cpp:760',
  }),
});
