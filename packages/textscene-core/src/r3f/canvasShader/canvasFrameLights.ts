import * as THREE from 'three';
import { mutableTransform2D, type Transform2DColumns } from '../../godot/math/transform2d';
import { transformInViewportInto, type TargetViewport } from '../../shaders/canvas/canvasBindings';
import { DARK_LIGHT_ROW, lightArrayWords, type CanvasLightsFrame } from '../../shaders/canvas/canvasLights';
import { perObject } from '../../utils/perObject';
import { canvasFrameOf } from '../canvasFrame';
import { layerLightOrder } from '../lighting2d/templateLights';
import type { CanvasLightRows } from '../lighting2d/lightRows';
import { renderTargetSize } from '../renderTargetSize';
import type { CanvasItemFrame } from './canvasFrameBlocks';
import { canvasDataTransformInto, targetViewportInto } from './canvasTransforms';

/** Where a light row is read from: the render's camera and target, and the canvas it lights. */
export interface CanvasLightView {
  readonly camera: THREE.Camera;
  readonly size: { readonly width: number; readonly height: number };
  /** Godot's viewport in the target, or undefined for the whole target. */
  readonly viewport: TargetViewport | undefined;
  /** `p_canvas_transform`: the canvas transform of the canvas the rows light, in viewport pixels. */
  readonly canvasTransform: Transform2DColumns;
}

/** Writes `object`'s local frame into `out` as the camera's transform into Godot's viewport pixels. */
export function onScreenInto(
  out: ReturnType<typeof mutableTransform2D>,
  view: Omit<CanvasLightView, 'canvasTransform'>,
  object: THREE.Object3D | null
): Transform2DColumns {
  canvasDataTransformInto(out, view.camera, object, view.size);
  return view.viewport ? transformInViewportInto(out, out, view.viewport) : out;
}

interface WrittenFrame {
  rows: CanvasLightRows;
  frameId: number;
  camera: THREE.Camera | null;
  frame: CanvasLightsFrame;
}

/** Written only by `canvasLightsOf`: by canvas frame, as two CanvasLayers can share one layer number. */
const writtenFramesOf = perObject((_canvas: object) => new Map<number, WrittenFrame>());

const targetSize = new THREE.Vector2();
const viewport: TargetViewport = { x: 0, y: 0, width: 0, height: 0, scale: 1 };
const canvasTransform = mutableTransform2D();

/** The light rows of `layer` for the render `drawn` belongs to, written once per render and camera. */
export function canvasLightsOf(
  gl: THREE.WebGLRenderer,
  drawn: CanvasItemFrame,
  rows: CanvasLightRows,
  layer: number
): CanvasLightsFrame {
  const canvas = canvasFrameOf(drawn.object);
  // The root canvas has no frame, so its frames go by camera, as `canvasDataOf` keys its blocks.
  const frames = writtenFramesOf(canvas ?? drawn.camera);
  const held = frames.get(layer);
  if (held && isWrittenFor(held, rows, drawn)) return held.frame;
  const view = lightView(gl, drawn.camera, canvas);
  const order = layerLightOrder(rows.lights, layer);
  const words = lightArrayWords(
    order.ordinals.map((ordinal) => rows.writers.get(ordinal)?.(view) ?? DARK_LIGHT_ROW)
  );
  // The words of the last write stay while the next equals them, so no draw uploads them again.
  const unchanged =
    held && held.frame.directionalCount === order.directionalCount && sameWords(held.frame.words, words);
  const frame = unchanged ? held.frame : { words, directionalCount: order.directionalCount };
  frames.set(layer, { rows, frameId: drawn.frameId, camera: drawn.camera, frame });
  return frame;
}

function isWrittenFor(held: WrittenFrame, rows: CanvasLightRows, drawn: CanvasItemFrame): boolean {
  return held.rows === rows && held.frameId === drawn.frameId && held.camera === drawn.camera;
}

function sameWords(a: Uint32Array, b: Uint32Array): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return false;
  return true;
}

function lightView(
  gl: THREE.WebGLRenderer,
  camera: THREE.Camera,
  canvas: THREE.Object3D | null
): CanvasLightView {
  const { x: width, y: height } = renderTargetSize(gl, targetSize);
  const size = { width, height };
  const target = { camera, size, viewport: targetViewportInto(viewport, camera, size) };
  return { ...target, canvasTransform: onScreenInto(canvasTransform, target, canvas) };
}
