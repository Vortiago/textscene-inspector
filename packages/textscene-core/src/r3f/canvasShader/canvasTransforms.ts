import * as THREE from 'three';
import type { MutableTransform2D } from '../../godot/math/transform2d';
import { FLIP_Y } from '../components/Canvas2DStage/world2DCamera';

/** Scratch for one transform, overwritten by the next call. */
const clip = new THREE.Matrix4();

/** Writes `canvas_data.canvas_transform` into `out`: `frame` in target pixels, as the camera sees it. */
export function canvasDataTransformInto(
  out: MutableTransform2D,
  camera: THREE.Camera,
  frame: THREE.Object3D | null,
  { width, height }: { readonly width: number; readonly height: number }
): MutableTransform2D {
  clip.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  if (frame) clip.multiply(frame.matrixWorld);
  const e = clip.multiply(FLIP_Y).elements;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  out.a = e[0]! * halfWidth;
  out.b = e[1]! * halfHeight;
  out.c = e[4]! * halfWidth;
  out.d = e[5]! * halfHeight;
  out.tx = (e[12]! + 1) * halfWidth;
  out.ty = (e[13]! + 1) * halfHeight;
  return out;
}
