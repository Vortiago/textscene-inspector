/**
 * DirectionalLight3D renderer registration - auto-registers DirectionalLight3D parser and renderer with the node registry.
 */

import { createDirectionalLight3D } from './renderer';
import { positionLightTarget } from '../../../../utils/lightTargetUtils';
import type { TscnScene } from '../../../../parser/types';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import * as THREE from 'three';
import { formatDirectionalLight3DProperties } from './propertyFormatter';
import { applyNode3DTransform } from '../../../base/node3d/renderer';
import { parseDirectionalLight3D, isDirectionalLight3D } from './parser';
import type { NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { decomposeTransform3D } from '../../../../utils/transform';
import type { DirectionalLight3DProperties } from './types';

const directionalLight3DRegistration: NodeTypeRegistration = {
  typeName: 'DirectionalLight3D',
  typeGuard: isDirectionalLight3D,
  parser: parseDirectionalLight3D,
  renderer: (
    name: string,
    properties: DirectionalLight3DProperties,
    _scene?: TscnScene
  ): THREE.Object3D => {
    const group = createDirectionalLight3D(name, properties);

    if (properties.transform) {
      applyNode3DTransform(group, properties);

      // Position the target based on the light's rotation
      const { rotation } = decomposeTransform3D(properties.transform);
      const quaternion = new THREE.Quaternion();
      quaternion.setFromEuler(new THREE.Euler(rotation.x, rotation.y, rotation.z));
      positionLightTarget(group, quaternion, 10);
    }

    return group;
  },
  propertyFormatter: formatDirectionalLight3DProperties,
};

nodeRegistry.register(directionalLight3DRegistration);

export { directionalLight3DRegistration };
export * from './parser';
export * from './renderer';
export * from './propertyFormatter';
export * from './types';
