/**
 * Transform utilities for decomposing Transform3D matrices.
 */

import type { Transform3D, DecomposedTransform } from '../nodes/node3d/types';
import { warn } from '../logger';

/**
 * Threshold for detecting gimbal lock singularity in rotation extraction.
 * When a basis vector component approaches ±1, we're near gimbal lock
 * and need alternative rotation extraction to avoid numerical instability.
 */
const ROTATION_SINGULARITY_THRESHOLD = 0.9999999;

/**
 * Parse Transform3D from string format.
 * Example: "Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)"
 */
export function parseTransform3D(transformString: string): Transform3D {
  const match = transformString.match(/Transform3D\(([\d\s.,e+-]+)\)/);
  if (!match || !match[1]) {
    throw new Error(`Invalid Transform3D format: ${transformString}`);
  }

  const values = match[1]
    .split(',')
    .map((v) => parseFloat(v.trim()))
    .filter((v) => !isNaN(v));

  if (values.length !== 12) {
    throw new Error(
      `Transform3D must have 12 values, got ${values.length}: ${transformString}`
    );
  }

  const [
    bx_x, bx_y, bx_z,
    by_x, by_y, by_z,
    bz_x, bz_y, bz_z,
    o_x, o_y, o_z
  ] = values as [number, number, number, number, number, number, number, number, number, number, number, number];

  return {
    basis_x: { x: bx_x, y: bx_y, z: bx_z },
    basis_y: { x: by_x, y: by_y, z: by_z },
    basis_z: { x: bz_x, y: bz_y, z: bz_z },
    origin: { x: o_x, y: o_y, z: o_z },
  };
}

/**
 * Decompose Transform3D matrix into position, rotation, and scale.
 */
export function decomposeTransform3D(
  transform: Transform3D
): DecomposedTransform {
  const position = { ...transform.origin };

  const scaleX = Math.sqrt(
    transform.basis_x.x ** 2 +
      transform.basis_x.y ** 2 +
      transform.basis_x.z ** 2
  );
  const scaleY = Math.sqrt(
    transform.basis_y.x ** 2 +
      transform.basis_y.y ** 2 +
      transform.basis_y.z ** 2
  );
  const scaleZ = Math.sqrt(
    transform.basis_z.x ** 2 +
      transform.basis_z.y ** 2 +
      transform.basis_z.z ** 2
  );

  const scale = { x: scaleX, y: scaleY, z: scaleZ };

  const basisX = {
    x: transform.basis_x.x / scaleX,
    y: transform.basis_x.y / scaleX,
    z: transform.basis_x.z / scaleX,
  };
  const basisY = {
    x: transform.basis_y.x / scaleY,
    y: transform.basis_y.y / scaleY,
    z: transform.basis_y.z / scaleY,
  };
  const basisZ = {
    x: transform.basis_z.x / scaleZ,
    y: transform.basis_z.y / scaleZ,
    z: transform.basis_z.z / scaleZ,
  };

  // Extract Euler angles (XYZ order) - based on Godot's Basis::get_euler()
  const rotation = {
    x: 0,
    y: 0,
    z: 0,
  };

  rotation.y = Math.asin(-basisZ.x);

  if (Math.abs(basisZ.x) < ROTATION_SINGULARITY_THRESHOLD) {
    rotation.x = Math.atan2(basisZ.y, basisZ.z);
    rotation.z = Math.atan2(basisY.x, basisX.x);
  } else {
    // Gimbal lock - use alternative calculation
    rotation.x = Math.atan2(-basisY.z, basisY.y);
    rotation.z = 0;
  }

  return { position, rotation, scale };
}

export function identityTransform3D(): Transform3D {
  return {
    basis_x: { x: 1, y: 0, z: 0 },
    basis_y: { x: 0, y: 1, z: 0 },
    basis_z: { x: 0, y: 0, z: 1 },
    origin: { x: 0, y: 0, z: 0 },
  };
}

/**
 * Parse optional transform property with error handling.
 * Returns undefined if no transform string provided.
 * Returns identity transform if parsing fails (with warning logged).
 */
export function parseOptionalTransform(
  transformString: string | undefined,
  nodeName: string
): Transform3D | undefined {
  if (!transformString) {
    return undefined;
  }

  try {
    return parseTransform3D(transformString);
  } catch (error) {
    warn(
      `Failed to parse transform for node "${nodeName}": ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return identityTransform3D();
  }
}
