import * as THREE from 'three';
import type { Rgba } from '../../godot/math/math';
import { mutableTransform2D } from '../../godot/math/transform2d';
import { canvasDataBlock, writeCanvasData, type CanvasDataBlock } from '../../shaders/canvas/canvasBindings';
import { canvasFrameOf } from '../canvasFrame';
import { perObject } from '../../utils/perObject';
import { renderTargetSize } from '../renderTargetSize';
import { canvasShaderTime } from '../shaderTime/canvasShaderTime';
import { canvasDataTransformInto } from './canvasTransforms';

/** One draw of a shaded item: the render it belongs to, and the object and camera it draws with. */
export interface CanvasItemFrame {
  readonly renderId: number;
  readonly object: THREE.Object3D;
  readonly camera: THREE.Camera;
}

/** The colours of a canvas that the block reads, which each of its items knows. */
export interface CanvasColors {
  /** The CanvasModulate colour of the canvas, white with none. */
  readonly canvasModulate: Rgba;
  readonly usesLinearColors: boolean;
}

interface WrittenBlock {
  readonly block: CanvasDataBlock;
  renderId: number;
  camera: THREE.Camera | null;
}

/** Written only by `canvasDataOf`: each canvas's block, rewritten by the first item each render draws. */
const writtenBlockOf = perObject((): WrittenBlock => ({
  block: canvasDataBlock(),
  renderId: -1,
  camera: null,
}));

/** Scratch of one write, overwritten by the next. */
const frame = {
  width: 0,
  height: 0,
  canvasTransform: mutableTransform2D(),
  canvasModulate: { r: 1, g: 1, b: 1, a: 1 } as Rgba,
  time: 0,
  snapVerticesToPixel: false,
  usesLinearColors: false,
};
const targetSize = new THREE.Vector2();

/** The block of the canvas `drawn.object` draws in, written for this render if no item wrote it yet. */
export function canvasDataOf(
  gl: THREE.WebGLRenderer,
  drawn: CanvasItemFrame,
  colors: CanvasColors
): CanvasDataBlock {
  const canvas = canvasFrameOf(drawn.object);
  const key = canvas ?? drawn.camera;
  const written = writtenBlockOf(key);
  // Render gate first: a canvas draws all its items in one render with one camera.
  if (written.renderId === drawn.renderId && written.camera === drawn.camera) return written.block;
  written.renderId = drawn.renderId;
  written.camera = drawn.camera;
  const { x: width, y: height } = renderTargetSize(gl, targetSize);
  frame.width = width;
  frame.height = height;
  canvasDataTransformInto(frame.canvasTransform, drawn.camera, canvas, frame);
  frame.canvasModulate = colors.canvasModulate;
  frame.time = canvasShaderTime(gl).time;
  frame.usesLinearColors = colors.usesLinearColors;
  writeCanvasData(written.block, frame);
  return written.block;
}
