import * as THREE from 'three';
import type { Transform2DColumns } from '../../godot/math/transform2d';

/** `F = diag(1, -1, 1)`, which turns Godot's y-down pixels into three's y-up world (`node2dTransform.ts`). */
const FLIP_Y = new THREE.Matrix4().makeScale(1, -1, 1);

/** Scratch for one transform, overwritten by the next call. */
const scratch = new THREE.Matrix4();

/** Godot's `Item::final_transform`: the transform of `object` in the canvas of `frame`, the world when null. */
export function itemTransformOf(object: THREE.Object3D, frame: THREE.Object3D | null): Transform2DColumns {
  const local = frame ? scratch.copy(frame.matrixWorld).invert().multiply(object.matrixWorld) : object.matrixWorld;
  const e = local.elements;
  // F · M · F negates the terms that cross the y axis.
  return { a: e[0]!, b: -e[1]!, c: -e[4]!, d: e[5]!, tx: e[12]!, ty: -e[13]! };
}

/**
 * `canvas_data.canvas_transform`: what carries the canvas of `frame` into the target's pixels, which
 * `screen_transform` turns into clip space. Read off three's projection of the canvas, so the pan,
 * zoom and CanvasLayer the camera and frame hold all fold in.
 */
export function canvasTransformOf(
  camera: THREE.Camera,
  frame: THREE.Object3D | null,
  { width, height }: { readonly width: number; readonly height: number }
): Transform2DColumns {
  const clip = scratch.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  if (frame) clip.multiply(frame.matrixWorld);
  const e = clip.multiply(FLIP_Y).elements;
  const [halfWidth, halfHeight] = [width / 2, height / 2];
  return {
    a: e[0]! * halfWidth,
    b: e[1]! * halfHeight,
    c: e[4]! * halfWidth,
    d: e[5]! * halfHeight,
    tx: (e[12]! + 1) * halfWidth,
    ty: (e[13]! + 1) * halfHeight,
  };
}
