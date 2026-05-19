/**
 * Shared helpers for mapping Godot Transform3D onto R3F group props.
 * Mirrors the imperative applyNode3DTransform but returns plain tuples
 * suitable for <group position={...} rotation={...} scale={...}>.
 */

import type { Node3DProperties, Transform3D } from '../nodes/base/node3d/types';
import { decomposeTransform3D } from '../utils/transform';

export type Vec3Tuple = [number, number, number];

export interface NodeTransform {
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  scale: Vec3Tuple;
}

export const IDENTITY_TRANSFORM: NodeTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

export function decomposeForR3F(transform: Transform3D | undefined): NodeTransform {
  if (!transform) return IDENTITY_TRANSFORM;
  const { position, rotation, scale } = decomposeTransform3D(transform);
  return {
    position: [position.x, position.y, position.z],
    rotation: [rotation.x, rotation.y, rotation.z],
    scale: [scale.x, scale.y, scale.z],
  };
}

/** Narrow helper used by every node type's component. */
export function transformFromNode3DProperties(properties: Node3DProperties): NodeTransform {
  return decomposeForR3F(properties.transform);
}
