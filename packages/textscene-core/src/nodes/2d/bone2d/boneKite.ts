/**
 * The kite Godot's editor draws for a Bone2D: a four-point fill and a six-point outline from the bone
 * to each Bone2D child, or along `length` and `bone_angle` where it has none
 * (`skeleton_2d.cpp:189-354`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { transform2DGetScale, type Transform2DColumns } from '../../../godot/math/transform2d.js';
import {
  normalizedVector2,
  vector2Add,
  vector2Orthogonal,
  vector2Scaled,
  vector2Sub,
  type Vector2,
} from '../../../godot/math/vector.js';

/** `editors/2d/bone_width` and `editors/2d/bone_outline_size` (`editor_settings.cpp:974,980`). */
const BONE_WIDTH = 5;
const BONE_OUTLINE_WIDTH = 2;

/** The points of a kite's outline and of its fill. */
export const OUTLINE_POINT_COUNT = 6;
export const FILL_POINT_COUNT = 4;

/** The polygons of one kite, in the bone's own pixels. */
export interface BoneKite {
  /** The kite, which the gizmo shades with two colours on alternate points. */
  fill: Vector2[];
  /** The border, a hexagon that holds the kite. */
  outline: Vector2[];
}

/** What a bone with no Bone2D child draws along (`skeleton_2d.cpp:329`). */
export interface BoneReach {
  length: number;
  angle: number;
}

function rotated({ x, y }: Vector2, angle: number): Vector2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function add(...points: [Vector2, ...Vector2[]]): Vector2 {
  return points.reduce(vector2Add);
}

/** `Bone2D::_editor_get_bone_shape` (`skeleton_2d.cpp:313-354`) for the tip `rel`, a bone's offset to its child. */
function kiteTo(rel: Vector2): BoneKite {
  const relt = vector2Scaled(normalizedVector2(vector2Scaled(vector2Orthogonal(rel), -1)), BONE_WIDTH);
  const reln = normalizedVector2(rel);
  const reltn = normalizedVector2(relt);
  const near = vector2Scaled(rel, 0.2);
  const along = (alongRel: number, alongTangent: number) =>
    vector2Scaled(add(vector2Scaled(reln, alongRel), vector2Scaled(reltn, alongTangent)), BONE_OUTLINE_WIDTH);
  return {
    fill: [{ x: 0, y: 0 }, add(near, relt), rel, add(near, vector2Scaled(relt, -1))],
    outline: [
      along(-1, -1),
      along(-1, 1),
      add(near, relt, vector2Scaled(reltn, BONE_OUTLINE_WIDTH)),
      add(rel, along(1, 1)),
      add(rel, along(1, -1)),
      add(near, vector2Scaled(relt, -1), vector2Scaled(reltn, -BONE_OUTLINE_WIDTH)),
    ],
  };
}

function scaledBy(points: readonly Vector2[], by: Vector2): Vector2[] {
  return points.map(({ x, y }) => ({ x: x * by.x, y: y * by.y }));
}

/**
 * The kites of a bone in its own pixels. `global` is the bone's global transform, `childOrigins` the
 * global origins of its Bone2D children in order, and `reach` what a bone with no such child draws.
 * Godot draws the kites on a canvas item that undoes the global scale of the bone
 * (`skeleton_2d.cpp:208-211`), and the points here take that scale back out, so they land in the
 * bone's space. A bone with a zero global scale divides by zero there and draws nothing.
 */
export function boneKitesOf(
  global: Transform2DColumns,
  childOrigins: readonly Vector2[],
  reach: BoneReach
): BoneKite[] {
  const scale = transform2DGetScale(global);
  if (scale.x === 0 || scale.y === 0) return [];
  const undoScale = { x: 1 / scale.x, y: 1 / scale.y };
  const globalRotation = Math.atan2(global.b, global.a);
  const rels =
    childOrigins.length > 0
      ? childOrigins.map((origin) =>
          rotated(vector2Sub(origin, { x: global.tx, y: global.ty }), -globalRotation)
        )
      : reachRel(reach, scale);
  return rels.map((rel) => {
    const kite = kiteTo(rel);
    return { fill: scaledBy(kite.fill, undoScale), outline: scaledBy(kite.outline, undoScale) };
  });
}

/** The tip of a bone with no child, or none where its length is not positive (`skeleton_2d.cpp:320-330`). */
function reachRel({ length, angle }: BoneReach, scale: Vector2): Vector2[] {
  if (length <= 0) return [];
  return [{ x: Math.cos(angle) * length * scale.x, y: Math.sin(angle) * length * scale.y }];
}
