/** SphereShape3D collision-shape resource parser. */

import { floatOr } from '../../../parser/valueParsers';

export interface SphereShape3DProperties {
  /** Sphere radius. class_sphereshape3d.html: default 0.5. */
  radius: number;
}

export function parseSphereShape3D(properties: Record<string, string>): SphereShape3DProperties {
  return { radius: floatOr(properties.radius, 0.5, 'SphereShape3D') };
}
