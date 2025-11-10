/**
 * WorldEnvironment node type definitions
 */

import type { Node3DProperties } from '../../base/node3d/types.js';

/**
 * WorldEnvironment node properties
 *
 * WorldEnvironment configures the global rendering environment including
 * background, fog, tonemapping, and other post-processing effects via
 * an Environment SubResource.
 */
export interface WorldEnvironmentProperties extends Node3DProperties {
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
