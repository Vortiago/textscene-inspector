import * as THREE from 'three';
import { mutableTransform2D, type MutableTransform2D } from '../../godot/math/transform2d';
import type { TargetViewport } from '../../shaders/canvas/canvasBindings';
import { FLIP_Y, World2DCamera } from '../components/Canvas2DStage/world2DCamera';

/** Scratch for one transform, overwritten by the next call. */
const clip = new THREE.Matrix4();
const worldInTarget = mutableTransform2D();

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

/** Writes where `camera` shows the viewport in a `size` target into `out`. Undefined: the whole target. */
export function targetViewportInto(
  out: TargetViewport,
  camera: THREE.Camera,
  size: { readonly width: number; readonly height: number }
): TargetViewport | undefined {
  const root = camera instanceof World2DCamera ? camera.rootViewport : null;
  if (!root) return undefined;
  // The stage's camera neither turns nor stretches, so one stage scale holds for both axes.
  const { a: stageScale, tx: x, ty: y } = canvasDataTransformInto(worldInTarget, camera, null, size);
  out.x = x;
  out.y = y;
  out.width = root.targetSize.x;
  out.height = root.targetSize.y;
  out.scaleX = stageScale / root.pixelsPerCanvasPixel.x;
  out.scaleY = stageScale / root.pixelsPerCanvasPixel.y;
  return out;
}
