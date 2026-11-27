import * as THREE from 'three';
import { mutableTransform2D, type Transform2DColumns } from '../../godot/math/transform2d';
import { transformInViewportInto, type TargetViewport } from '../../shaders/canvas/canvasBindings';
import { MAX_LIGHTS_PER_RENDER } from '../../godot/rendering/rendering';
import {
  lightArrayWords,
  type CanvasLightRow,
  type CanvasLightsFrame,
} from '../../shaders/canvas/canvasLights';
import { RowStore, type RowRegion } from '../../shaders/template/rowStore';
import { perObject } from '../../utils/perObject';
import { canvasFrameOf } from '../canvasFrame';
import { layerLightCandidates } from '../lighting2d/templateLights';
import type { CanvasLightDeclaration } from '../lighting2d/itemLightList';
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

/** One canvas layer's light rows as the last listing left them. */
interface WrittenFrame {
  readonly layer: number;
  rows: CanvasLightRows;
  /** The render the frame was listed for, and its camera and target size. */
  frameId: number;
  camera: THREE.Camera | null;
  readonly size: { width: number; height: number };
  /** `renderer.info.render.frame` when the record writers last listed the frame. */
  writtenAtRender: number;
  frame: CanvasLightsFrame;
  /** The ordinals and rows the frame lists, in order: a listing of the same keeps the frame. */
  readonly ordinals: number[];
  readonly listed: CanvasLightRow[];
  /** The texture of the frame's words, which every lit draw of the layer reads. */
  readonly store: RowStore;
  readonly region: RowRegion;
}

/** Written only by this module's listings, by canvas frame: two CanvasLayers can share a layer number. */
const writtenFramesOf = perObject((_canvas: object) => new Map<number, WrittenFrame>());

const targetSize = new THREE.Vector2();
const viewport: TargetViewport = { x: 0, y: 0, width: 0, height: 0, scale: 1 };
const canvasTransform = mutableTransform2D();

/** Scratch of one listing, compared with the last one before it is kept. */
const ordinals: number[] = [];
const listed: CanvasLightRow[] = [];

/** The light rows of `layer` for the render `drawn` belongs to, listed once per render and camera. */
export function canvasLightsOf(
  gl: THREE.WebGLRenderer,
  drawn: CanvasItemFrame,
  rows: CanvasLightRows,
  layer: number
): CanvasLightsFrame {
  const canvas = canvasFrameOf(drawn.object);
  // The root canvas has no frame, and its light pass owns its rows for its life.
  const frames = writtenFramesOf(canvas ?? rows);
  const held = frames.get(layer) ?? newWrittenFrame(frames, layer);
  if (isWrittenFor(held, rows, drawn)) return held.frame;
  const { x: width, y: height } = renderTargetSize(gl, targetSize);
  held.size.width = width;
  held.size.height = height;
  held.rows = rows;
  held.frameId = drawn.frameId;
  held.camera = drawn.camera;
  return relist(held, canvas);
}

// Three uploads records before any draw hook (`WebGLRenderer.js:1912`), so records index lights from this.
/** The rows of `layer` for the next render of `object`, on the last render's view, or null before one. */
export function nextCanvasLightsOf(
  gl: THREE.WebGLRenderer,
  object: THREE.Object3D,
  rows: CanvasLightRows,
  layer: number
): CanvasLightsFrame | null {
  const canvas = canvasFrameOf(object);
  const held = writtenFramesOf(canvas ?? rows).get(layer);
  if (!held?.camera || held.rows !== rows) return null;
  const renders = gl.info.render.frame;
  if (held.writtenAtRender === renders) return held.frame;
  held.writtenAtRender = renders;
  return relist(held, canvas);
}

/** Lists the held layer's lights again on its view, and keeps the frame while the listing holds. */
function relist(held: WrittenFrame, canvas: THREE.Object3D | null): CanvasLightsFrame {
  const view = lightView(held.camera!, held.size, canvas);
  const directionalCount = listLights(held.rows.lights, held.layer, view);
  if (!isSameListing(held, directionalCount)) keepListing(held, directionalCount);
  return held.frame;
}

/** Lists the lights of `layer` on `view` into the scratch, directional first, at most 256 in all. */
function listLights(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  layer: number,
  view: CanvasLightView
): number {
  ordinals.length = 0;
  listed.length = 0;
  const candidates = layerLightCandidates(lights, layer);
  listEach(lights, candidates.directional, view);
  const directionalCount = ordinals.length;
  listEach(lights, candidates.positional, view);
  return directionalCount;
}

function listEach(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  candidates: readonly number[],
  view: CanvasLightView
): void {
  for (const ordinal of candidates) {
    if (ordinals.length === MAX_LIGHTS_PER_RENDER) return;
    const row = lights.get(ordinal)!.rowSource?.listedRow(view);
    if (!row) continue;
    ordinals.push(ordinal);
    listed.push(row);
  }
}

function newWrittenFrame(frames: Map<number, WrittenFrame>, layer: number): WrittenFrame {
  const store = new RowStore();
  const held: WrittenFrame = {
    layer,
    rows: { lights: new Map() },
    frameId: Number.NaN,
    camera: null,
    size: { width: 0, height: 0 },
    writtenAtRender: Number.NaN,
    frame: { words: new Uint32Array(0), directionalCount: 0, indexOf: new Map(), texture: store.texture },
    ordinals: [],
    listed: [],
    store,
    region: store.region(),
  };
  frames.set(layer, held);
  return held;
}

function isWrittenFor(held: WrittenFrame, rows: CanvasLightRows, drawn: CanvasItemFrame): boolean {
  return held.rows === rows && held.frameId === drawn.frameId && held.camera === drawn.camera;
}

/** A row source answers the same row while nothing it reads moved, so equal objects are equal rows. */
function isSameListing(held: WrittenFrame, directionalCount: number): boolean {
  if (held.frame.directionalCount !== directionalCount || held.ordinals.length !== ordinals.length)
    return false;
  for (let index = 0; index < ordinals.length; index++)
    if (held.ordinals[index] !== ordinals[index] || held.listed[index] !== listed[index]) return false;
  return true;
}

/** Keeps the scratch listing as the layer's frame, and writes its words into the layer's texture. */
function keepListing(held: WrittenFrame, directionalCount: number): void {
  held.ordinals.splice(0, held.ordinals.length, ...ordinals);
  held.listed.splice(0, held.listed.length, ...listed);
  const words = lightArrayWords(listed);
  held.store.write(held.region, words);
  held.frame = {
    words,
    directionalCount,
    indexOf: new Map(ordinals.map((ordinal, index) => [ordinal, index])),
    texture: held.store.texture,
  };
}

function lightView(
  camera: THREE.Camera,
  size: { readonly width: number; readonly height: number },
  canvas: THREE.Object3D | null
): CanvasLightView {
  const target = { camera, size, viewport: targetViewportInto(viewport, camera, size) };
  return { ...target, canvasTransform: onScreenInto(canvasTransform, target, canvas) };
}
