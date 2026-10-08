/** Billboard modes, and the AABB a billboarded Sprite3D or Label3D gives the scene cull. */

import type { Aabb } from './aabb.js';

/**
 * `BaseMaterial3D::BillboardMode` (`scene/resources/material.h:300-306`), in Godot's own
 * member names, as the integers a `.tscn` stores for `billboard_mode` (`material.cpp:3740`).
 * Sprite3D and Label3D read the same enum through `SpriteBase3D`, which refuses PARTICLES.
 */
export enum BillboardMode {
  BILLBOARD_DISABLED = 0,
  BILLBOARD_ENABLED = 1,
  BILLBOARD_FIXED_Y = 2,
  BILLBOARD_PARTICLES = 3,
}

/** `Vector3::AXIS_Y`, the one sprite axis whose FIXED_Y box reads the rect height (`sprite_3d.cpp:266`). */
const AXIS_Y = 1;

/**
 * A Label3D's AABB under its billboard mode (`label_3d.cpp:624-642`). ENABLED grows the line box
 * to a cube about the origin, and FIXED_Y to a prism about the Y axis that keeps its height.
 */
export function labelBillboardAabb(box: Aabb, mode: number): Aabb {
  switch (mode) {
    case BillboardMode.BILLBOARD_ENABLED:
      return cube(Math.max(reachX(box), reachY(box)));
    case BillboardMode.BILLBOARD_FIXED_Y:
      return prism(box, reachX(box));
    default:
      return box;
  }
}

/**
 * A SpriteBase3D's AABB under its billboard mode (`sprite_3d.cpp:252-273`), from its box on the
 * axis plane and its 2D rect, both in world units. The rect is the quad before the axis turns it.
 */
export function spriteBillboardAabb(box: Aabb, rect: Aabb, mode: number, axis: number): Aabb {
  switch (mode) {
    case BillboardMode.BILLBOARD_ENABLED:
      return cube(Math.max(reachX(rect), reachY(rect)));
    case BillboardMode.BILLBOARD_FIXED_Y:
      return prism(box, axis === AXIS_Y ? Math.max(reachX(rect), reachY(rect)) : reachX(rect));
    default:
      return box;
  }
}

/** `MAX(Math::abs(position.x), position.x + size.x)`: the reach the C++ measures, not the far edge. */
function reachX({ position, size }: Aabb): number {
  return Math.max(Math.abs(position.x), position.x + size.x);
}

function reachY({ position, size }: Aabb): number {
  return Math.max(Math.abs(position.y), position.y + size.y);
}

function cube(halfSize: number): Aabb {
  return {
    position: { x: -halfSize, y: -halfSize, z: -halfSize },
    size: { x: halfSize * 2, y: halfSize * 2, z: halfSize * 2 },
  };
}

function prism(box: Aabb, halfWidth: number): Aabb {
  return {
    position: { x: -halfWidth, y: box.position.y, z: -halfWidth },
    size: { x: halfWidth * 2, y: box.size.y, z: halfWidth * 2 },
  };
}
