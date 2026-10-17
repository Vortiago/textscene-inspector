/** Godot 4.6.3's Node3D facts a scene's properties carry. */

import { enumNamesByValue, pascalCaseLabel, relabelEnumNames } from '../classdb/enumNames.js';

/** `EulerOrder` (`core/math/math_defs.h:129-136`), the order `rotation_order` stores. */
const EulerOrder = {
  XYZ: 0,
  XZY: 1,
  YXZ: 2,
  YZX: 3,
  ZXY: 4,
  ZYX: 5,
} as const;

/** `Node3D::RotationEditMode` (`scene/3d/node_3d.h:62-66`). */
const RotationEditMode = {
  EULER: 0,
  QUATERNION: 1,
  BASIS: 2,
} as const;

/** Each Euler order by its integer, spelled as its axes (`node_3d.cpp:1533`). */
export const NODE_3D_ROTATION_ORDER_NAMES = enumNamesByValue(EulerOrder);

/** Each edit mode by its integer, spelled as the inspector hint prints it (`node_3d.cpp:1532`). */
export const NODE_3D_ROTATION_EDIT_MODE_NAMES = relabelEnumNames(
  enumNamesByValue(RotationEditMode),
  pascalCaseLabel
);
