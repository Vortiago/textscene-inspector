/**
 * Node3D renderer - renders Node3D nodes using three.js.
 */

import * as THREE from 'three';
import type { Node3DProperties } from './types';
import { decomposeTransform3D } from '../../../utils/transform';

/**
 * Create an invisible container for a Node3D node.
 * Node3D has no visual representation in Godot except when highlighted.
 */
export function createNode3DGizmo(nodeName: string): THREE.Object3D {
  const group = new THREE.Group();
  group.name = nodeName;
  return group;
}

/**
 * Apply transform properties to a three.js object.
 */
export function applyNode3DTransform(
  object: THREE.Object3D,
  properties: Node3DProperties
): void {
  if (!properties.transform) {
    return;
  }

  const { position, rotation, scale } = decomposeTransform3D(properties.transform);

  object.position.set(position.x, position.y, position.z);
  object.rotation.set(rotation.x, rotation.y, rotation.z);
  object.scale.set(scale.x, scale.y, scale.z);
}
