/**
 * NavigationRegion3D-specific type definitions.
 */

import type { Node3DProperties } from '../../base/node3d/types';

export interface NavigationRegion3DProperties extends Node3DProperties {
  /** `navigation_mesh` reference (ExtResource / res://) to a NavigationMesh .tres. */
  navigationMesh?: string;
}
