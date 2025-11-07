/**
 * Camera3D renderer registration - auto-registers Camera3D parser and renderer with the node registry.
 */

import { createCamera3D } from './renderer';
import type { TscnScene } from '../../../parser/types';
import { nodeRegistry } from '../../../core/NodeRegistry';
import * as THREE from 'three';
import { formatCamera3DProperties } from './propertyFormatter';
import { parseCamera3D, isCamera3D } from './parser';
import type { NodeTypeRegistration } from '../../../core/NodeRegistry';
import type { Camera3DProperties } from './types';

const camera3DRegistration: NodeTypeRegistration = {
  typeName: 'Camera3D',
  typeGuard: isCamera3D,
  parser: parseCamera3D,
  renderer: (name: string, properties: Camera3DProperties, _scene?: TscnScene): THREE.Object3D => {
    return createCamera3D(name, properties);
  },
  propertyFormatter: formatCamera3DProperties,
};

nodeRegistry.register(camera3DRegistration);

export { camera3DRegistration };
export * from './parser';
export * from './renderer';
export * from './propertyFormatter';
export * from './types';
