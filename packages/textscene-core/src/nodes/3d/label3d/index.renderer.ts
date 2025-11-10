/**
 * Label3D renderer registration - auto-registers Label3D parser and renderer with the node registry.
 */

import { createLabel3D } from './renderer';
import type { TscnScene } from '../../../parser/types';
import { nodeRegistry } from '../../../core/NodeRegistry';
import * as THREE from 'three';
import { formatLabel3DProperties } from './propertyFormatter';
import { parseLabel3D, isLabel3D } from './parser';
import type { NodeTypeRegistration } from '../../../core/NodeRegistry';
import type { Label3DProperties } from './types';

const label3DRegistration: NodeTypeRegistration = {
  typeName: 'Label3D',
  typeGuard: isLabel3D,
  parser: parseLabel3D,
  renderer: (name: string, properties: Label3DProperties, _scene?: TscnScene): THREE.Object3D => {
    return createLabel3D(name, properties);
  },
  propertyFormatter: formatLabel3DProperties,
};

nodeRegistry.register(label3DRegistration);

export { label3DRegistration };
export * from './parser';
export * from './renderer';
export * from './propertyFormatter';
export * from './types';
