/**
 * OmniLight3D renderer registration - auto-registers OmniLight3D parser and renderer.
 */

import * as THREE from 'three';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import type { NodeTypeRegistration } from '../../../../core/NodeRegistry';
import type { TscnScene } from '../../../../parser/types';
import { parseOmniLight3D, isOmniLight3D } from './parser';
import { createOmniLight3D } from './renderer';
import { formatOmniLight3DProperties } from './propertyFormatter';
import { applyNode3DTransform } from '../../../base/node3d/renderer';
import type { OmniLight3DProperties } from './types';

const omniLight3DRegistration: NodeTypeRegistration = {
  typeName: 'OmniLight3D',
  typeGuard: isOmniLight3D,
  parser: parseOmniLight3D,
  renderer: (
    name: string,
    properties: OmniLight3DProperties,
    _scene?: TscnScene
  ): THREE.Object3D => {
    const light = createOmniLight3D(name, properties);

    if (properties.transform) {
      applyNode3DTransform(light, properties);
    }

    return light;
  },
  propertyFormatter: formatOmniLight3DProperties,
};

nodeRegistry.register(omniLight3DRegistration);

export { omniLight3DRegistration };
export * from './parser';
export * from './renderer';
export * from './propertyFormatter';
export * from './types';
