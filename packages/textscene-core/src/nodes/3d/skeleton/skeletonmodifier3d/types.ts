/** SkeletonModifier3D type definitions. */

import type { Node3DProperties } from '../../../base/node3d/types';

/** The properties every SkeletonModifier3D reads (`skeleton_modifier_3d.h:90-91`). */
export interface SkeletonModifier3DProperties extends Node3DProperties {
  /** A modifier that is not active changes nothing (`skeleton_modifier_3d.cpp:119-124`). */
  active: boolean;
  /** The share of its edit the Skeleton3D keeps, applied below one (`skeleton_3d.cpp:1175-1197`). */
  influence: number;
}
