/**
 * SpotLight3D renderer registration - auto-registers SpotLight3D parser and renderer with the node registry.
 */

import { createSpotLight3D, positionSpotLightTarget } from './renderer';
import type { TscnScene } from '../../../../parser/types';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import * as THREE from 'three';
import { formatSpotLight3DProperties } from './propertyFormatter';
import { applyNode3DTransform } from '../../../base/node3d/renderer';
import { parseSpotLight3D, isSpotLight3D } from './parser';
import type { NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { decomposeTransform3D } from '../../../../utils/transform';
import type { SpotLight3DProperties } from './types';

const spotLight3DRegistration: NodeTypeRegistration = {
  typeName: 'SpotLight3D',
  typeGuard: isSpotLight3D,
  parser: parseSpotLight3D,
  renderer: (name: string, properties: SpotLight3DProperties, _scene?: TscnScene): THREE.Object3D => {
    const group = createSpotLight3D(name, properties);

    if (properties.transform) {
      applyNode3DTransform(group, properties);

      // Position the target based on the light's rotation
      const { rotation } = decomposeTransform3D(properties.transform);
      const quaternion = new THREE.Quaternion();
      quaternion.setFromEuler(new THREE.Euler(rotation.x, rotation.y, rotation.z));
      positionSpotLightTarget(group, quaternion, properties.spot_range);
    }

    return group;
  },
  propertyFormatter: formatSpotLight3DProperties,
};

nodeRegistry.register(spotLight3DRegistration);

export { spotLight3DRegistration };
export * from './parser';
export * from './renderer';
export * from './propertyFormatter';
export * from './types';
