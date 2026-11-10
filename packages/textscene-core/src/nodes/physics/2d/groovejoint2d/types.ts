/** GrooveJoint2D properties: the spring joint's `length`, and the offset its marker draws. */

import type { DampedSpringJoint2DProperties } from '../dampedspringjoint2d/types';

export interface GrooveJoint2DProperties extends DampedSpringJoint2DProperties {
  /** Pixels along local +Y to the second body's anchor (`groove_joint_2d.h:41`, default 25). */
  initial_offset: number;
}
