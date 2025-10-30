/**
 * Base Node type - minimal properties for hierarchy tracking.
 */

import type { Transform3D } from '../node3d/types';

export interface NodeProperties {
  name: string;
  parent?: string;
  instance?: string;
  transform?: Transform3D; // 3D transformation matrix
}
