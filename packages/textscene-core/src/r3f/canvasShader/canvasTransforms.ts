import * as THREE from 'three';
import type { Transform2DColumns } from '../../godot/math/transform2d';
import { FLIP_Y } from '../components/Canvas2DStage/world2DCamera';

/** Scratch for one transform, overwritten by the next call. */
const clip = new THREE.Matrix4();

/** `canvas_data.canvas_transform`: the canvas of `frame` in target pixels, with the camera's pan and zoom. */
export function canvasTransformOf(
  camera: THREE.Camera,
  frame: THREE.Object3D | null,
  { width, height }: { readonly width: number; readonly height: number }
): Transform2DColumns {
  clip.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  if (frame) clip.multiply(frame.matrixWorld);
  const e = clip.multiply(FLIP_Y).elements;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return {
    a: e[0]! * halfWidth,
    b: e[1]! * halfHeight,
    c: e[4]! * halfWidth,
    d: e[5]! * halfHeight,
    tx: (e[12]! + 1) * halfWidth,
    ty: (e[13]! + 1) * halfHeight,
  };
}
