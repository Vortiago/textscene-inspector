/** The lines of the editor gizmo of a Camera3D (`camera_3d_gizmo_plugin.cpp:139-258`), in the camera's local space. */

import { degToRad } from '../../../godot/math/math';
import { normalizedVector3 } from '../../../godot/math/vector';
import { Camera3DKeepAspect, Camera3DProjectionType } from '../../../godot/scene/camera3d';
import type { CameraLens } from './projectionFit';

export interface CameraGizmoInput {
  lens: CameraLens;
  /** The `near` property: only the frustum projection reads it. */
  near: number;
  /** The aspect of the viewport that the camera renders (`Node3DEditor::get_camera_viewport_size`). */
  aspect: number;
}

type Point = readonly [number, number, number];

const ORIGIN: Point = [0, 0, 0];

/** How far the up triangle reaches above the top edge, and how wide its base is (`:199-201`). */
const UP_TRIANGLE_HEIGHT = 0.5;
const UP_TRIANGLE_HALF_WIDTH = 0.25;

const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subtract = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const negate = (a: Point): Point => [-a[0], -a[1], -a[2]];

/** A closed outline as flat segments: `ADD_TRIANGLE` for three corners, `ADD_QUAD` for four (`:154-174`). */
function outline(...corners: Point[]): number[] {
  return corners.flatMap((start, index) => [...start, ...corners[(index + 1) % corners.length]!]);
}

/** The width and height factors that fit the frustum in a unit box of the viewport's shape (`:152`). */
function sizeFactor(viewportAspect: number): { x: number; y: number } {
  return viewportAspect > 1 ? { x: 1, y: 1 / viewportAspect } : { x: viewportAspect, y: 1 };
}

/** Four triangles from the origin to the rectangle at `side` and `±upY`, then the up triangle. */
function pyramidLines(side: Point, upY: number, hsize: number, offset: Point): number[] {
  const nside: Point = [-side[0], side[1], side[2]];
  const corner = ([x, y, z]: Point, vertical: number) => add([x, y + vertical, z], offset);
  const narrowSide = Math.min(side[0], hsize * UP_TRIANGLE_HALF_WIDTH);
  const apex = add([0, upY + hsize * UP_TRIANGLE_HEIGHT, side[2]], offset);
  return [
    ...outline(ORIGIN, corner(side, upY), corner(side, -upY)),
    ...outline(ORIGIN, corner(nside, upY), corner(nside, -upY)),
    ...outline(ORIGIN, corner(side, upY), corner(nside, upY)),
    ...outline(ORIGIN, corner(side, -upY), corner(nside, -upY)),
    ...outline(
      apex,
      corner([narrowSide, side[1], side[2]], upY),
      corner([-narrowSide, side[1], side[2]], upY)
    ),
  ];
}

/** `PROJECTION_PERSPECTIVE` (`:177-203`). The depth of `side` takes the width factor under KEEP_WIDTH. */
function perspectiveLines({ fov, keepAspect }: CameraLens, viewportAspect: number): number[] {
  const factor = sizeFactor(viewportAspect);
  const halfFov = degToRad(fov / 2);
  const hsize = Math.sin(halfFov);
  const depth = -Math.cos(halfFov);
  const side: Point = [
    hsize * factor.x,
    0,
    depth * (keepAspect === Camera3DKeepAspect.KEEP_WIDTH ? factor.x : factor.y),
  ];
  return pyramidLines(side, hsize * factor.y, hsize, ORIGIN);
}

/** `PROJECTION_ORTHOGONAL` (`:205-232`): the near and far quads, the sides between them, the up triangle. */
function orthogonalLines({ size, keepAspect }: CameraLens, viewportAspect: number): number[] {
  const keepSize = size * 0.5;
  const back: Point = [0, 0, -1];
  const isKeepWidth = keepAspect === Camera3DKeepAspect.KEEP_WIDTH;
  const right: Point = isKeepWidth ? [keepSize, 0, 0] : [keepSize * viewportAspect, 0, 0];
  const up: Point = isKeepWidth ? [0, keepSize / viewportAspect, 0] : [0, keepSize, 0];

  const upRight = add(up, right);
  const upLeft = subtract(up, right);
  const downRight = subtract(right, up);
  const downLeft = negate(upRight);
  const behind = (point: Point) => add(point, back);

  const narrowRight = Math.min(right[0], keepSize * UP_TRIANGLE_HALF_WIDTH);
  const apex: Point = [0, up[1] + keepSize * UP_TRIANGLE_HEIGHT, back[2]];
  return [
    ...outline(downLeft, downRight, upRight, upLeft),
    ...outline(behind(downLeft), behind(downRight), behind(upRight), behind(upLeft)),
    ...outline(upRight, behind(upRight), behind(upLeft), upLeft),
    ...outline(downRight, behind(downRight), behind(downLeft), downLeft),
    ...outline(apex, behind(add(up, [narrowRight, 0, 0])), behind(add(up, [-narrowRight, 0, 0]))),
  ];
}

/**
 * `PROJECTION_FRUSTUM` (`:234-252`). Godot normalises `(size / 2, 0, -near)` and narrows the up
 * triangle by `size / 2`, not by the normalised side.
 */
function frustumLines({ size, frustumOffset }: CameraLens, near: number, viewportAspect: number): number[] {
  const factor = sizeFactor(viewportAspect);
  const hsize = size / 2;
  const [sideX, sideY, sideZ] = normalizedVector3(hsize, 0, -near);
  const side: Point = [sideX * factor.x, sideY, sideZ];
  return pyramidLines(side, hsize * factor.y, hsize, [frustumOffset.x, frustumOffset.y, 0]);
}

/** The gizmo's segments as flat `xyz` pairs: a pyramid for a perspective or frustum camera, a box for an orthogonal one. */
export function cameraGizmoLines({ lens, near, aspect }: CameraGizmoInput): Float32Array {
  // A viewport with no area has no aspect, and Godot reads it as 1 (`:151`).
  const viewportAspect = aspect > 0 ? aspect : 1;
  switch (lens.projection) {
    case Camera3DProjectionType.ORTHOGONAL:
      return new Float32Array(orthogonalLines(lens, viewportAspect));
    case Camera3DProjectionType.FRUSTUM:
      return new Float32Array(frustumLines(lens, near, viewportAspect));
    default:
      return new Float32Array(perspectiveLines(lens, viewportAspect));
  }
}
