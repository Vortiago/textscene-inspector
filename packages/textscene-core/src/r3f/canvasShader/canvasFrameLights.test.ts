import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { type CanvasLightRow } from '../../shaders/canvas/canvasLights';
import { DEFAULT_LIGHT_CULL_KEY } from '../lighting2d/lightCullKey';
import type { CanvasLightDeclaration } from '../lighting2d/itemLightList';
import type { CanvasLightRows, LightRowWriter } from '../lighting2d/lightRows';
import { canvasLightsOf } from './canvasFrameLights';

const gl = {
  getRenderTarget: () => null,
  getDrawingBufferSize: (size: THREE.Vector2) => size.set(64, 32),
} as unknown as THREE.WebGLRenderer;

const camera = new THREE.OrthographicCamera(-32, 32, 16, -16);

function positional(sequence: number): CanvasLightDeclaration {
  return {
    reach: { ...DEFAULT_LIGHT_CULL_KEY, layerMin: 0, layerMax: 0 },
    sequence,
    shadowItemCullMask: null,
    castsShadow: false,
    tintsShadow: false,
    mixes: false,
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

function rowsOf(writers: Record<number, LightRowWriter>): CanvasLightRows {
  return {
    lights: new Map([
      [0, positional(0)],
      [1, positional(1)],
    ]),
    writers: new Map(Object.entries(writers).map(([ordinal, writer]) => [Number(ordinal), writer])),
  };
}

const drawn = (frameId: number) => ({ frameId, object: new THREE.Object3D(), camera });

/** `sizeof(LightUniform)` in 32-bit words (`renderer_canvas_render_rd.h:443-457`). */
const ROW_WORDS = 32;

const redOf = (words: Uint32Array, index: number) => new Float32Array(words.buffer)[index * ROW_WORDS + 16];

describe('canvasLightsOf', () => {
  it("writes each listed light's row at its index of the layer's order", () => {
    const rows = rowsOf({ 0: () => rowOf(0.25), 1: () => rowOf(0.75) });

    const { words } = canvasLightsOf(gl, drawn(1), rows, 0);

    expect([redOf(words, 0), redOf(words, 1)]).toEqual([0.25, 0.75]);
  });

  it('keeps a dark row at the index of a light whose writer is not registered yet', () => {
    const rows = rowsOf({ 1: () => rowOf(0.75) });

    const { words } = canvasLightsOf(gl, drawn(1), rows, 0);

    expect([redOf(words, 0), redOf(words, 1)]).toEqual([0, 0.75]);
  });

  it('writes the rows once for the draws of one render', () => {
    const writer = vi.fn(() => rowOf(0.5));
    const rows = rowsOf({ 0: writer, 1: writer });

    canvasLightsOf(gl, drawn(1), rows, 0);
    canvasLightsOf(gl, drawn(1), rows, 0);

    expect(writer).toHaveBeenCalledTimes(2);
  });

  it('writes the rows again for the next render', () => {
    const writer = vi.fn(() => rowOf(0.5));
    const rows = rowsOf({ 0: writer, 1: writer });

    canvasLightsOf(gl, drawn(1), rows, 0);
    canvasLightsOf(gl, drawn(2), rows, 0);

    expect(writer).toHaveBeenCalledTimes(4);
  });

  it('hands back the last words while a new render writes the same, so no draw uploads them again', () => {
    const rows = rowsOf({ 0: () => rowOf(0.25), 1: () => rowOf(0.75) });

    const first = canvasLightsOf(gl, drawn(1), rows, 0);

    expect(canvasLightsOf(gl, drawn(2), rows, 0).words).toBe(first.words);
  });

  it('hands new words once a light changes', () => {
    let red = 0.25;
    const rows = rowsOf({ 0: () => rowOf(red), 1: () => rowOf(0.75) });
    const first = canvasLightsOf(gl, drawn(1), rows, 0);

    red = 0.5;
    const second = canvasLightsOf(gl, drawn(2), rows, 0);

    expect([second.words === first.words, redOf(second.words, 0)]).toEqual([false, 0.5]);
  });
});
