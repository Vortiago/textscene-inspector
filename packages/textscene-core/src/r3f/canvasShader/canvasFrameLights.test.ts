import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { type CanvasLightRow } from '../../shaders/canvas/canvasLights';
import { DEFAULT_LIGHT_CULL_KEY } from '../lighting2d/lightCullKey';
import type { CanvasLightDeclaration } from '../lighting2d/itemLightList';
import type { CanvasLightRows, LightRowSource } from '../lighting2d/lightRows';
import { markCanvasFrame } from '../canvasFrame';
import { mutableTransform2D } from '../../godot/math/transform2d';
import { transformInViewportInto } from '../../shaders/canvas/canvasBindings';
import { canvasLightsOf, nextCanvasLightsOf, onScreenInto } from './canvasFrameLights';

const info = { render: { frame: 0 } };

const gl = {
  getRenderTarget: () => null,
  getDrawingBufferSize: (size: THREE.Vector2) => size.set(64, 32),
  info,
} as unknown as THREE.WebGLRenderer;

const camera = new THREE.OrthographicCamera(-32, 32, 16, -16);

function light(sequence: number | null, rowSource: LightRowSource): CanvasLightDeclaration {
  return {
    reach: { ...DEFAULT_LIGHT_CULL_KEY, layerMin: 0, layerMax: 0 },
    sequence,
    slot: sequence === null ? 0 : undefined,
    shadowItemCullMask: null,
    castsShadow: false,
    tintsShadow: false,
    mixes: false,
    rowSource,
  };
}

const rowOf = (r: number): CanvasLightRow => ({
  textureMatrix: { a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 },
  color: { r, g: 0, b: 0, a: 1 },
  flags: 0,
  height: 0,
  position: { x: 0, y: 0 },
  atlasRect: { x: 0, y: 0, w: 0, h: 0 },
});

/** A source that lists `row`, or no row while it is null, counting its listings. */
function sourceOf(row: CanvasLightRow | null) {
  const source = { row, listedRow: vi.fn(() => source.row) };
  return source;
}

const positionalRows = (...sources: LightRowSource[]): CanvasLightRows => ({
  lights: new Map(sources.map((source, ordinal) => [ordinal, light(ordinal, source)])),
});

const drawn = (frameId: number) => ({ frameId, object: new THREE.Object3D(), camera });

function drawnIn(canvas: THREE.Object3D, frameId: number) {
  const object = new THREE.Object3D();
  canvas.add(object);
  return { frameId, object, camera };
}

function canvasFrame(): THREE.Object3D {
  const frame = new THREE.Object3D();
  markCanvasFrame(frame);
  return frame;
}

/** `sizeof(LightUniform)` in 32-bit words (`renderer_canvas_render_rd.h:443-457`). */
const ROW_WORDS = 32;

const redOf = (words: Uint32Array, index: number) => new Float32Array(words.buffer)[index * ROW_WORDS + 16];

describe('canvasLightsOf', () => {
  it("writes each listed light's row at its index of the layer's order", () => {
    const rows = positionalRows(sourceOf(rowOf(0.25)), sourceOf(rowOf(0.75)));

    const { words } = canvasLightsOf(gl, drawn(1), rows, 0);

    expect([redOf(words, 0), redOf(words, 1)]).toEqual([0.25, 0.75]);
  });

  it('lists a light with no row on screen at no index, so the next light takes its place', () => {
    const rows = positionalRows(sourceOf(null), sourceOf(rowOf(0.75)));

    const frame = canvasLightsOf(gl, drawn(1), rows, 0);

    expect([frame.indexOf.get(0), frame.indexOf.get(1), redOf(frame.words, 0)]).toEqual([undefined, 0, 0.75]);
  });

  it('lists the directional lights first, and counts them', () => {
    const sun = sourceOf(rowOf(0.5));
    const rows: CanvasLightRows = {
      lights: new Map([
        [0, light(0, sourceOf(rowOf(0.25)))],
        [1, light(null, sun)],
      ]),
    };

    const frame = canvasLightsOf(gl, drawn(1), rows, 0);

    expect([frame.directionalCount, frame.indexOf.get(1), frame.indexOf.get(0)]).toEqual([1, 0, 1]);
  });

  it("caps a render at Godot's 256 lights, counting only the lights on screen", () => {
    const offScreen = Array.from({ length: 100 }, () => sourceOf(null));
    const onScreen = Array.from({ length: 300 }, () => sourceOf(rowOf(0.5)));
    const rows = positionalRows(...offScreen, ...onScreen);

    const frame = canvasLightsOf(gl, drawn(1), rows, 0);

    expect([frame.indexOf.size, frame.indexOf.get(100), frame.indexOf.has(356)]).toEqual([256, 0, false]);
  });

  it('lists the lights once for the draws of one render', () => {
    const source = sourceOf(rowOf(0.5));
    const rows = positionalRows(source);

    canvasLightsOf(gl, drawn(1), rows, 0);
    canvasLightsOf(gl, drawn(1), rows, 0);

    expect(source.listedRow).toHaveBeenCalledTimes(1);
  });

  it('lists the lights for each canvas of one layer number in one render', () => {
    const source = sourceOf(rowOf(0.5));
    const rows = positionalRows(source);

    canvasLightsOf(gl, drawnIn(canvasFrame(), 1), rows, 0);
    canvasLightsOf(gl, drawnIn(canvasFrame(), 1), rows, 0);

    expect(source.listedRow).toHaveBeenCalledTimes(2);
  });

  it('hands back the last frame while a new render lists the same rows, so no draw uploads them again', () => {
    const rows = positionalRows(sourceOf(rowOf(0.25)), sourceOf(rowOf(0.75)));

    const first = canvasLightsOf(gl, drawn(1), rows, 0);

    expect(canvasLightsOf(gl, drawn(2), rows, 0)).toBe(first);
  });

  it('hands a new frame once a light hands a new row', () => {
    const source = sourceOf(rowOf(0.25));
    const rows = positionalRows(source, sourceOf(rowOf(0.75)));
    const first = canvasLightsOf(gl, drawn(1), rows, 0);

    source.row = rowOf(0.5);
    const second = canvasLightsOf(gl, drawn(2), rows, 0);

    expect([second === first, redOf(second.words, 0)]).toEqual([false, 0.5]);
  });

  it('writes every frame of a layer into one texture, which each lit draw binds', () => {
    const source = sourceOf(rowOf(0.25));
    const rows = positionalRows(source);
    const first = canvasLightsOf(gl, drawn(1), rows, 0);

    source.row = rowOf(0.5);

    expect(canvasLightsOf(gl, drawn(2), rows, 0).texture).toBe(first.texture);
  });
});

describe('nextCanvasLightsOf', () => {
  it('lists nothing before the first render of the layer', () => {
    expect(nextCanvasLightsOf(gl, new THREE.Object3D(), positionalRows(sourceOf(rowOf(0.5))), 0)).toBeNull();
  });

  it("lists the layer through the last render's view, so records index the lights before the draw", () => {
    const source = sourceOf(rowOf(0.25));
    const rows = positionalRows(source);
    const object = new THREE.Object3D();
    canvasLightsOf(gl, { frameId: 1, object, camera }, rows, 0);

    source.row = null;

    expect(nextCanvasLightsOf(gl, object, rows, 0)?.indexOf.size).toBe(0);
  });

  it('lists the layer once for the record writes before one render', () => {
    const source = sourceOf(rowOf(0.25));
    const rows = positionalRows(source);
    const object = new THREE.Object3D();
    canvasLightsOf(gl, { frameId: 1, object, camera }, rows, 0);
    info.render.frame += 1;

    nextCanvasLightsOf(gl, object, rows, 0);
    nextCanvasLightsOf(gl, object, rows, 0);

    expect(source.listedRow).toHaveBeenCalledTimes(2);
  });
});

describe('onScreenInto', () => {
  const size = { width: 64, height: 32 };
  const object = new THREE.Object3D();
  object.position.set(4, -2, 0);
  object.updateMatrixWorld();

  it("ends an object's frame in Godot's viewport inside the target", () => {
    const viewport = { x: 8, y: 4, width: 32, height: 16, scale: 2 };
    const inTarget = onScreenInto(mutableTransform2D(), { camera, size, viewport: undefined }, object);
    const expected = transformInViewportInto(mutableTransform2D(), inTarget, viewport);
    expect(onScreenInto(mutableTransform2D(), { camera, size, viewport }, object)).toEqual(expected);
  });

  it("places an object at the camera's centre at the target's centre, with no viewport", () => {
    const centred = new THREE.Object3D();
    const onScreen = onScreenInto(mutableTransform2D(), { camera, size, viewport: undefined }, centred);
    expect([onScreen.tx, onScreen.ty]).toEqual([32, 16]);
  });
});
