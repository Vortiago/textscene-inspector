/** GrooveJoint2D properties: the Node2D transform, and the two lengths its marker draws. */

import type { Node2DProperties } from '../../../base/node2d/types';

export interface GrooveJoint2DProperties extends Node2DProperties {
  /** Pixels along local +Y to the far end of the groove (`groove_joint_2d.h:40`). */
  length: number;
  /** Pixels along local +Y to the second body's anchor (`groove_joint_2d.h:41`, default 25). */
  initial_offset: number;
}
