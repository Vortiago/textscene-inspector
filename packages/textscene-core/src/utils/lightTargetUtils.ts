/**
 * Shared utilities for lights that require targets (SpotLight, DirectionalLight)
 */

import * as THREE from 'three';
import { warn } from '../logger';

/**
 * Create a Group containing a light and its target, properly linked.
 * Used by SpotLight3D and DirectionalLight3D which require targets for direction.
 *
 * @param light - The three.js light (SpotLight or DirectionalLight)
 * @param nodeName - Name for the group and target
 * @returns Group containing the light and its target
 */
export function createLightWithTarget(
  light: THREE.SpotLight | THREE.DirectionalLight,
  nodeName: string
): THREE.Group {
  const target = new THREE.Object3D();
  target.name = `${nodeName}_target`;

  const group = new THREE.Group();
  group.name = nodeName;
  group.add(light);
  group.add(target);

  light.target = target;

  return group;
}

/**
 * Position a light's target based on rotation quaternion.
 * The target is placed in the direction the light is pointing.
 *
 * @param group - The group containing the light and target
 * @param quaternion - Rotation to apply for direction calculation
 * @param distance - Distance from light to target (default: 10)
 */
export function positionLightTarget(
  group: THREE.Group,
  quaternion: THREE.Quaternion,
  distance: number = 10
): void {
  const target = group.children.find((child) => child.name.endsWith('_target'));

  if (!target) {
    warn('positionLightTarget: Could not find target in group');
    return;
  }

  // Godot's -Z is forward
  const direction = new THREE.Vector3(0, 0, -1);
  direction.applyQuaternion(quaternion);

  target.position.copy(direction.multiplyScalar(distance));
}
