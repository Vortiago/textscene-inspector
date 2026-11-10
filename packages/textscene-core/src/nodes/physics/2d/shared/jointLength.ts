/** The `length` of a 2D joint that has an axis, 50 px by default (`groove_joint_2d.h:40`, `damped_spring_joint_2d.h:43`). */

import { floatOr } from '../../../../parser/valueParsers';

export function parseJointLength(raw: string | undefined): number {
  return floatOr(raw, 50);
}
