/**
 * WorldEnvironment renderer registration - auto-registers WorldEnvironment parser and renderer with the node registry.
 */

import { createWorldEnvironment } from './renderer.js';
import type { TscnScene } from '../../../parser/types.js';
import { nodeRegistry } from '../../../core/NodeRegistry.js';
import * as THREE from 'three';
import { formatWorldEnvironmentProperties } from './propertyFormatter.js';
import { parseWorldEnvironment, isWorldEnvironment } from './parser.js';
import type { NodeTypeRegistration } from '../../../core/NodeRegistry.js';
import type { WorldEnvironmentProperties } from './types.js';

const worldEnvironmentRegistration: NodeTypeRegistration = {
  typeName: 'WorldEnvironment',
  typeGuard: isWorldEnvironment,
  parser: parseWorldEnvironment,
  renderer: (name: string, properties: WorldEnvironmentProperties, scene?: TscnScene): THREE.Object3D => {
    return createWorldEnvironment(name, properties, scene);
  },
  propertyFormatter: formatWorldEnvironmentProperties,
};

nodeRegistry.register(worldEnvironmentRegistration);

export { worldEnvironmentRegistration };
export * from './parser.js';
export * from './renderer.js';
export * from './propertyFormatter.js';
export * from './types.js';
