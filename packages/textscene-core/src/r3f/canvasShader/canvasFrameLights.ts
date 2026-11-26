import * as THREE from 'three';
import { mutableTransform2D, type Transform2DColumns } from '../../godot/math/transform2d';
import { transformInViewportInto, type TargetViewport } from '../../shaders/canvas/canvasBindings';
import {
  lightArrayWords,
  type CanvasLightRow,
  type CanvasLightsFrame,
} from '../../shaders/canvas/canvasLights';
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

/** Writes `object`'s local frame into `out` as a transform into Godot's viewport pixels, as the camera sees it. */
export function onScreenInto(
  out: ReturnType<typeof mutableTransform2D>,
  view: CanvasLightView,
  object: THREE.Object3D
): Transform2DColumns {
  canvasDataTransformInto(out, view.camera, object, view.size);
  return view.viewport ? transformInViewportInto(out, out, view.viewport) : out;
}

interface WrittenFrame {
  frameId: number;
  camera: THREE.Camera | null;
  frame: CanvasLightsFrame;
}

/** Written only by `canvasLightsOf`: each canvas's frames by layer, one per render and camera. */
const writtenFramesOf = perObject((_rows: CanvasLightRows) => new Map<number, WrittenFrame>());

/** An unlit row, for a declared light whose row is not registered yet: its index still holds. */
const DARK_ROW: CanvasLightRow = Object.freeze({
  textureMatrix: { a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 },
  color: { r: 0, g: 0, b: 0, a: 0 },
  flags: 0,
  height: 0,
  position: { x: 0, y: 0 },
  atlasRect: { x: 0, y: 0, w: 0, h: 0 },
});

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
  const frames = writtenFramesOf(rows);
  const held = frames.get(layer);
  if (held && held.frameId === drawn.frameId && held.camera === drawn.camera) return held.frame;
  const view = lightView(gl, drawn);
  const order = layerLightOrder(rows.lights, layer);
  const words = lightArrayWords(
    order.ordinals.map((ordinal) => rows.writers.get(ordinal)?.(view) ?? DARK_ROW)
  );
  // The words of the last write stay while the next equals them, so no draw uploads them again.
  const unchanged =
    held && held.frame.directionalCount === order.directionalCount && sameWords(held.frame.words, words);
  const frame = unchanged ? held.frame : { words, directionalCount: order.directionalCount };
  frames.set(layer, { frameId: drawn.frameId, camera: drawn.camera, frame });
  return frame;
}

function sameWords(a: Uint32Array, b: Uint32Array): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return false;
  return true;
}

function lightView(gl: THREE.WebGLRenderer, drawn: CanvasItemFrame): CanvasLightView {
  const { x: width, y: height } = renderTargetSize(gl, targetSize);
  const size = { width, height };
  const inTarget = targetViewportInto(viewport, drawn.camera, size);
  canvasDataTransformInto(canvasTransform, drawn.camera, canvasFrameOf(drawn.object), size);
  if (inTarget) transformInViewportInto(canvasTransform, canvasTransform, inTarget);
  return { camera: drawn.camera, size, viewport: inTarget, canvasTransform };
}
