/** The NavigationRegion2D property shape. */

import type { Node2DProperties } from '../../base/node2d/types';

export interface NavigationRegion2DProperties extends Node2DProperties {
  /** `navigation_polygon` reference (ExtResource / res://) to a NavigationPolygon .tres. */
  navigationPolygon?: string;
}
