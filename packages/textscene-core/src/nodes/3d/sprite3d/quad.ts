/**
 * The quad a SpriteBase3D draws: its rect on the sprite plane, that rect turned onto the plane
 * its `axis` faces, the frame and the modulate its vertices carry, and the AABB the scene cull
 * reads (`sprite_3d.cpp:100-273`).
 */

import * as THREE from 'three';
import type { Aabb } from '../../../godot/math/aabb';
import { spriteBillboardAabb } from '../../../godot/scene/billboard';
import { Vector3Axis } from '../../../godot/math/vector3Axis';
import type { Sprite3DProperties } from './types';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';
import type { UvWindow } from '../../../r3f/uvWindow';
import type { Rect2 } from '../../../godot/math/rect2';
import type { Rgba } from '../../../godot/math/math';
import { vertexColourAttribute, writeVertexColour } from '../../../r3f/vertexColour';

/** The quad's size in world units: the frame's pixels times `pixel_size`. */
interface QuadSize {
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
 * The part of `quad` that `drawn` of `frame` fills, both in texture pixels. An AtlasTexture draws
 * its region alone, so a margin leaves the quad smaller than the frame (`sprite_3d.cpp:100-122`).
 */
export function spriteQuadPart(
  { position, size }: Aabb,
  frame: Rect2,
  drawn: Rect2,
  pixelSize: number
): Aabb {
  const fromLeft = drawn.x - frame.x;
  const fromBottom = frame.y + frame.h - (drawn.y + drawn.h);
  return {
    position: { ...position, x: position.x + fromLeft * pixelSize, y: position.y + fromBottom * pixelSize },
    size: { ...size, x: drawn.w * pixelSize, y: drawn.h * pixelSize },
  };
}

/**
 * The quad on the plane `axis` faces, with its normal along the axis (`sprite_3d.cpp:166-198`).
 * AXIS_Y takes the rect's Y to -Z and AXIS_X takes its X to -Z.
 */
export function spriteQuadGeometry(
  { position, size }: Aabb,
  axis: EnumValue<typeof Vector3Axis>
): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(size.x, size.y);
  geometry.translate(position.x + size.x / 2, position.y + size.y / 2, 0);
  if (axis === Vector3Axis.Y) geometry.rotateX(-Math.PI / 2);
  else if (axis === Vector3Axis.X) geometry.rotateY(Math.PI / 2);
  // White until `writeSpriteQuadColour` writes the modulate.
  geometry.setAttribute('color', vertexColourAttribute(QUAD_CORNERS.length, WHITE));
  return geometry;
}

const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };

/** A PlaneGeometry's corners in vertex order: top-left, top-right, bottom-left, bottom-right. */
const QUAD_CORNERS = [
  { u: 0, v: 1 },
  { u: 1, v: 1 },
  { u: 0, v: 0 },
  { u: 1, v: 0 },
] as const;

/**
 * Writes the frame's window into the quad's UVs, as Godot's sprite mesh holds it
 * (`sprite_3d.cpp:146-161`). On the mesh, not the texture, so a `material_override` or a
 * `material_overlay` samples the same frame.
 */
export function writeSpriteQuadUvs(geometry: THREE.BufferGeometry, { repeat, offset }: UvWindow): void {
  const uvs = geometry.getAttribute('uv');
  QUAD_CORNERS.forEach(({ u, v }, vertex) => {
    uvs.setXY(vertex, offset.x + repeat.x * u, offset.y + repeat.y * v);
  });
  uvs.needsUpdate = true;
}

/**
 * Writes the accumulated modulate into the quad's vertex colour, as Godot's sprite mesh holds it:
 * a float32 channel cut to a byte and never rounded (`sprite_3d.cpp:223-228`). The sprite's own
 * material reads the modulate as its colour, so only a material that reads the vertex colour sees it.
 */
export function writeSpriteQuadColour(geometry: THREE.BufferGeometry, modulate: Rgba): void {
  writeVertexColour(geometry.getAttribute('color') as THREE.BufferAttribute, modulate);
}

/** The quad's AABB in node space under `billboard`, as `_draw` sets it (`sprite_3d.cpp:252-273`). */
export function spriteQuadAabb(rect: Aabb, axis: EnumValue<typeof Vector3Axis>, billboard: number): Aabb {
  return spriteBillboardAabb(quadOnAxis(rect, axis), rect, billboard, axis);
}

function quadOnAxis({ position, size }: Aabb, axis: EnumValue<typeof Vector3Axis>): Aabb {
  switch (axis) {
    case Vector3Axis.Y:
      return {
        position: { x: position.x, y: 0, z: -(position.y + size.y) },
        size: { x: size.x, y: 0, z: size.y },
      };
    case Vector3Axis.X:
      return {
        position: { x: 0, y: position.y, z: -(position.x + size.x) },
        size: { x: 0, y: size.y, z: size.x },
      };
    default:
      return { position, size };
  }
}
