import * as THREE from 'three';
import type { Rgba } from '../../godot/math/math';
import { mutableTransform2D } from '../../godot/math/transform2d';
import { canvasDataBlock, writeCanvasData, type CanvasDataBlock } from '../../shaders/canvas/canvasBindings';
import { WHITE } from '../../shaders/canvas/canvasInstance';
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
  readonly colors: { -readonly [K in keyof CanvasColors]: CanvasColors[K] };
}

/** Written only by `canvasDataOf`: each canvas's blocks, one for each set of colours its items draw with. */
const writtenBlocksOf = perObject((): WrittenBlock[] => []);

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

/** The block of the canvas `drawn.object` draws in with `colors`, written once per render. */
export function canvasDataOf(
  gl: THREE.WebGLRenderer,
  drawn: CanvasItemFrame,
  colors: CanvasColors
): CanvasDataBlock {
  const canvas = canvasFrameOf(drawn.object);
  const blocks = writtenBlocksOf(canvas ?? drawn.camera);
  let free: WrittenBlock | undefined;
  // A loop, not `.find`: no closure per draw per render.
  for (const written of blocks) {
    if (!isWrittenFor(written, drawn)) free ??= written;
    else if (sameColors(written.colors, colors)) return written.block;
  }
  // A block of an earlier render is free, so a canvas holds as many blocks as one render's colour sets.
  const written = free ?? newWrittenBlock(blocks);
  written.renderId = drawn.renderId;
  written.camera = drawn.camera;
  written.colors.canvasModulate = colors.canvasModulate;
  written.colors.usesLinearColors = colors.usesLinearColors;
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

/** Whether `written` holds the block of the render and camera `drawn` belongs to. */
function isWrittenFor(written: WrittenBlock, drawn: CanvasItemFrame): boolean {
  return written.renderId === drawn.renderId && written.camera === drawn.camera;
}

function newWrittenBlock(blocks: WrittenBlock[]): WrittenBlock {
  const colors = { canvasModulate: WHITE, usesLinearColors: false };
  const written = { block: canvasDataBlock(), renderId: -1, camera: null, colors };
  blocks.push(written);
  return written;
}

function sameColors(a: CanvasColors, b: CanvasColors): boolean {
  const { canvasModulate: x } = a;
  const { canvasModulate: y } = b;
  return (
    a.usesLinearColors === b.usesLinearColors && x.r === y.r && x.g === y.g && x.b === y.b && x.a === y.a
  );
}
