/** NavigationRegion3D type definitions. */

import type { Node3DProperties } from '../../base/node3d/types';

export interface NavigationRegion3DProperties extends Node3DProperties {
  /** The `navigation_mesh` reference to a NavigationMesh, an ExtResource or a sub-resource. */
  navigationMesh?: string;
}
