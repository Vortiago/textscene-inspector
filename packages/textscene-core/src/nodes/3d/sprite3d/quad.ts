/**
 * The quad a SpriteBase3D draws: its rect on the sprite plane, that rect turned onto the plane
 * its `axis` faces, and the AABB the scene cull reads (`sprite_3d.cpp:100-273`).
 */

import * as THREE from 'three';
import type { Aabb } from '../../../godot/aabb';
import { spriteBillboardAabb } from '../../../godot/billboard';
import { AxisMode, type Sprite3DProperties } from './types';

/** The quad's size in world units: the frame's pixels times `pixel_size`. */
export interface QuadSize {
  width: number;
  height: number;
}

/**
 * The quad's rect on the sprite plane, in world units. Godot draws the 2D rect `offset` minus half
 * the frame when centred (`sprite_3d.cpp:817-823`) with its Y unflipped, so a positive `offset.y`
 * moves the quad up and an uncentred quad sits above and right of the origin (`:122-129`).
 */
export function spriteQuadRect(
  { width, height }: QuadSize,
  { centered, offset, pixel_size }: Pick<Sprite3DProperties, 'centered' | 'offset' | 'pixel_size'>
): Aabb {
  return {
    position: {
      x: offset.x * pixel_size - (centered ? width / 2 : 0),
      y: offset.y * pixel_size - (centered ? height / 2 : 0),
      z: 0,
    },
    size: { x: width, y: height, z: 0 },
  };
}

/**
 * The quad on the plane `axis` faces, with its normal along the axis (`sprite_3d.cpp:166-198`).
 * AXIS_Y takes the rect's Y to -Z and AXIS_X takes its X to -Z.
 */
export function spriteQuadGeometry({ position, size }: Aabb, axis: AxisMode): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(size.x, size.y);
  geometry.translate(position.x + size.x / 2, position.y + size.y / 2, 0);
  if (axis === AxisMode.AXIS_Y) geometry.rotateX(-Math.PI / 2);
  else if (axis === AxisMode.AXIS_X) geometry.rotateY(Math.PI / 2);
  return geometry;
}

/** The quad's AABB in node space under `billboard`, as `_draw` sets it (`sprite_3d.cpp:252-273`). */
export function spriteQuadAabb(rect: Aabb, axis: AxisMode, billboard: number): Aabb {
  return spriteBillboardAabb(quadOnAxis(rect, axis), rect, billboard, axis);
}

function quadOnAxis({ position, size }: Aabb, axis: AxisMode): Aabb {
  switch (axis) {
    case AxisMode.AXIS_Y:
      return {
        position: { x: position.x, y: 0, z: -(position.y + size.y) },
        size: { x: size.x, y: 0, z: size.y },
      };
    case AxisMode.AXIS_X:
      return {
        position: { x: 0, y: position.y, z: -(position.x + size.x) },
        size: { x: 0, y: size.y, z: size.x },
      };
    default:
      return { position, size };
  }
}
