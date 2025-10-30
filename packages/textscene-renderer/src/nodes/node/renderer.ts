/**
 * Base Node renderer - creates empty Object3D for hierarchy tracking.
 */

import { Object3D } from 'three';
import type { NodeProperties } from './types';
import type { TscnScene } from '../../parser/types';
import { decomposeTransform3D } from '../../utils/transform';

export function createNode(
  name: string,
  properties: NodeProperties,
  _scene?: TscnScene
): Object3D {
  // Base Node is just an empty container for hierarchy
  const object = new Object3D();
  object.name = name;

  // Apply transform if present (instance nodes often have transforms)
  if (properties.transform) {
    const { position, rotation, scale } = decomposeTransform3D(properties.transform);
    object.position.set(position.x, position.y, position.z);
    object.rotation.set(rotation.x, rotation.y, rotation.z);
    object.scale.set(scale.x, scale.y, scale.z);
  }

  return object;
}
