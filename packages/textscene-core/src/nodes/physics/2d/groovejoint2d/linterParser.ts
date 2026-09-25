/**
 * GrooveJoint2D strict validators: the 2 members doc/classes/GrooveJoint2D.xml lists without
 * `overrides=`, which match groove_joint_2d.cpp's ADD_PROPERTY list. The NODE_BASE_TYPES
 * base-walk delivers everything from Joint2D up, and a re-declared key shadows it.
 */

import '../../joints/shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('GrooveJoint2D', {
  // groove_joint_2d.cpp:87, PROPERTY_HINT_RANGE "1,65535,1,exp,suffix:px", no
  // `,or_greater`/`,or_less`. set_length (:63-66) is a bare assignment, so
  // out-of-range warns.
  length: v.float('length', { min: 1, max: 65535, hinted: 'groove_joint_2d.cpp:87' }),
  // groove_joint_2d.cpp:88, same hint shape. set_initial_offset (:72-75) is a
  // bare assignment, so out-of-range warns.
  initial_offset: v.float('initial_offset', {
    min: 1,
    max: 65535,
    hinted: 'groove_joint_2d.cpp:88',
  }),
});
