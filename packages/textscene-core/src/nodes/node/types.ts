/**
 * Base Node type - minimal properties for hierarchy tracking.
 */

import type { Transform3D } from '../base/node3d/types';

export interface NodeProperties {
  name: string;
  parent?: string;
  instance?: string;
  index?: number; // Child index for editable instance overrides (e.g., parent="." index="0")
  transform?: Transform3D; // 3D transformation matrix
}
