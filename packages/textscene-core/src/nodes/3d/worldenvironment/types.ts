/**
 * WorldEnvironment node type definitions
 */

import type { NodeProperties } from '../../node/types.js';

/**
 * WorldEnvironment configures the global rendering environment, including background, fog,
 * tonemapping and other post-processing effects, through an Environment resource.
 */
export interface WorldEnvironmentProperties extends NodeProperties {
  /**
   * Reference to Environment SubResource (required)
   * Format: SubResource("Environment_123")
   */
  environment: string;

  /**
   * Reference to CameraAttributes SubResource (optional)
   * Format: SubResource("CameraAttributes_123")
   *
   * Its `exposure_multiplier` scales the frame (`r3f/environment/worldExposure.tsx`).
   */
  camera_attributes?: string;
}
