/** DampedSpringJoint2D properties: the Node2D transform, and the length its marker draws. */

import type { Node2DProperties } from '../../../base/node2d/types';

export interface DampedSpringJoint2DProperties extends Node2DProperties {
  /** Pixels along local +Y to the second body's anchor (`damped_spring_joint_2d.h:43`, default 50). */
  length: number;
}
