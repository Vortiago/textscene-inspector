/** Godot 4.6.3's SkeletonModification2D facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/**
 * `SkeletonModificationStack2D::EXECUTION_MODE`
 * (`scene/resources/2d/skeleton/skeleton_modification_stack_2d.h:60-63`), each member without
 * `execution_mode_`. A modification stores it as a plain int, so a file can hold any other number.
 */
export const SkeletonModification2DExecutionMode = {
  PROCESS: 0,
  PHYSICS_PROCESS: 1,
} as const;

/** The labels of {@link SkeletonModification2DExecutionMode}, by value. */
export const SKELETON_MODIFICATION_2D_EXECUTION_MODE_NAMES = enumNamesByValue(
  SkeletonModification2DExecutionMode
);
