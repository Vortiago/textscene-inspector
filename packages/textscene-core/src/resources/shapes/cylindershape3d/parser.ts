/** CylinderShape3D collision-shape resource parser. */

import { floatOr } from '../../../parser/valueParsers';

export interface CylinderShape3DProperties {
  /** Cylinder radius. class_cylindershape3d.html: default 0.5. */
  radius: number;
  /** Full height along the local Y axis. class_cylindershape3d.html: default 2.0. */
  height: number;
}

export function parseCylinderShape3D(
  properties: Record<string, string>
): CylinderShape3DProperties {
  return {
    radius: floatOr(properties.radius, 0.5, 'CylinderShape3D'),
    height: floatOr(properties.height, 2, 'CylinderShape3D'),
  };
}
