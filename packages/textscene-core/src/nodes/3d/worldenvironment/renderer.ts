/**
 * WorldEnvironment renderer - creates three.js marker group with environment settings
 */

import * as THREE from 'three';
import type { WorldEnvironmentProperties } from './types.js';
import type { TscnScene } from '../../../parser/types.js';
import { applyNode3DTransform } from '../../base/node3d/renderer.js';
import { parseResourceReference } from '../../../resources/ResourceManager.js';
import { parseEnvironment } from '../../../resources/environment/parser.js';
import { createEnvironmentSettings } from '../../../resources/environment/renderer.js';
import type { EnvironmentSettings } from '../../../resources/environment/renderer.js';
import { warn } from '../../../logger.js';

/**
 * Create a WorldEnvironment marker node
 *
 * WorldEnvironment is a marker node that doesn't render visually but holds
 * environment settings (background, fog, post-processing) that should be
 * applied to the THREE.js scene.
 *
 * The settings are stored in group.userData.environmentSettings and must be
 * applied to the scene separately (see TscnRenderer.applyWorldEnvironment()).
 */
export function createWorldEnvironment(
  name: string,
  properties: WorldEnvironmentProperties,
  scene?: TscnScene
): THREE.Group {
  const group = new THREE.Group();
  group.name = name;

  // Apply Node3D transform
  applyNode3DTransform(group, properties);

  // Store node type
  group.userData.nodeType = 'WorldEnvironment';
  group.userData.properties = properties;

  // Resolve and parse Environment SubResource if scene is provided
  if (scene && properties.environment) {
    const environmentSettings = resolveEnvironmentSettings(properties.environment, scene);
    if (environmentSettings) {
      group.userData.environmentSettings = environmentSettings;
    }
  }

  return group;
}

/**
 * Resolve Environment SubResource and create settings
 */
function resolveEnvironmentSettings(
  environmentRef: string,
  scene: TscnScene
): EnvironmentSettings | null {
  // Parse environment reference
  const ref = parseResourceReference(environmentRef);
  if (!ref || ref.type !== 'SubResource') {
    warn(`WorldEnvironment: Invalid environment reference "${environmentRef}"`);
    return null;
  }

  // Find Environment SubResource
  const envResource = scene.internalResources.find(r => {
    const resourceId = r.data.id as string | undefined;
    return resourceId === ref.id || String(r.id) === ref.id;
  });

  if (!envResource) {
    warn(`WorldEnvironment: Environment SubResource "${ref.id}" not found`);
    return null;
  }

  // Verify resource type
  if (envResource.type !== 'Environment') {
    warn(`WorldEnvironment: Expected Environment SubResource, got "${envResource.type}"`);
    return null;
  }

  // Parse Environment properties
  const envProperties = parseEnvironment(envResource.data as Record<string, string>);

  // Create settings object
  return createEnvironmentSettings(envProperties);
}

/**
 * Get environment settings from a WorldEnvironment group
 */
export function getEnvironmentSettings(group: THREE.Group): EnvironmentSettings | null {
  return (group.userData.environmentSettings as EnvironmentSettings) || null;
}
