/**
 * WorldEnvironment node type definitions
 */

import type { NodeProperties } from '../../node/types.js';

/**
 * WorldEnvironment node properties
 *
 * WorldEnvironment configures the global rendering environment including
 * background, fog, tonemapping, and other post-processing effects via
 * an Environment SubResource.
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
   * Note: Not yet implemented in renderer (v1 deferred)
   */
  camera_attributes?: string;
}
