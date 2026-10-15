/**
 * `Vector3::Axis` (`vector3.h:57-61`). A Sprite3D stores it as `axis`, the axis its quad's normal points
 * along (`sprite_3d.cpp:166-198`), with AXIS_Z as the default (`sprite_3d.h:77`). The skeleton
 * modifiers store it as `primary_rotation_axis`.
 */

import { enumNamesByValue } from '../classdb/enumNames.js';

export enum Vector3Axis {
  X = 0,
  Y = 1,
  Z = 2,
}

/** Each axis named as its enum hint names it, "X,Y,Z". */
export const VECTOR3_AXIS_NAMES = enumNamesByValue(Vector3Axis);
