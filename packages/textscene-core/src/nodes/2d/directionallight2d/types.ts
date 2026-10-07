/** The DirectionalLight2D property shape: the Light2D surface plus its own two members. */

import type { Light2DProperties } from '../lights/shared/types';

export interface DirectionalLight2DProperties extends Light2DProperties {
  /** `DirectionalLight2D.height`: the light's tilt toward the canvas, read only by normal maps. */
  height: number;
  /**
   * `DirectionalLight2D.max_distance`, in canvas pixels: how far beyond the viewport edge,
   * toward the light, an occluder still casts a shadow.
   */
  max_distance: number;
}
