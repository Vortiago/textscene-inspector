import * as THREE from 'three';
import type { UniformNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { TRANSFORM2D_IDENTITY } from '../../godot/math/transform2d.js';
import {
  bindCanvasData,
  type CanvasFrame,
  canvasDataBlock,
  writeCanvasBindings,
  writeCanvasData,
} from './canvasBindings.js';
import { DEFAULT_CANVAS_SHADER, transpileCanvasItem } from './transpileCanvas.js';

const FRAME: CanvasFrame = {
  width: 128,
  height: 64,
  canvasTransform: { a: 2, b: 0, c: 0, d: 2, tx: 10, ty: -4 },
  canvasModulate: { r: 1, g: 0.5, b: 0.25, a: 1 },
  time: 1.5,
  snapVerticesToPixel: true,
};

function written(frame: CanvasFrame = FRAME) {
  const draw = transpileCanvasItem(DEFAULT_CANVAS_SHADER).draw('quad');
  writeCanvasBindings(draw, frame);
  return (name: string) => (draw.uniforms.get(`canvas_data.${name}`) as UniformNode<unknown>).value;
}

/** A pixel through `matrix`, as the template turns `vec4(vertex, 0.0, 1.0)`. */
const through = (matrix: unknown, x: number, y: number) =>
  new THREE.Vector4(x, y, 0, 1)
    .applyMatrix4(matrix as THREE.Matrix4)
    .toArray()
    .slice(0, 2);

describe('writeCanvasBindings', () => {
  it('maps the corners of the target to Vulkan clip space, y down', () => {
    const value = written();

    expect([through(value('screen_transform'), 0, 0), through(value('screen_transform'), 128, 64)]).toEqual([
      [-1, -1],
      [1, 1],
    ]);
  });

  it('writes the canvas transform with its origin', () => {
    expect(through(written()('canvas_transform'), 3, 5)).toEqual([16, 6]);
  });

  it('writes the canvas transform with unit axes and no origin as the normal transform', () => {
    expect(through(written()('canvas_normal_transform'), 3, 5)).toEqual([3, 5]);
  });

  it('keeps a zero axis of the canvas transform zero in the normal transform', () => {
    const value = written({ ...FRAME, canvasTransform: { ...TRANSFORM2D_IDENTITY, a: 0 } });

    expect(through(value('canvas_normal_transform'), 3, 5)).toEqual([0, 5]);
  });

  it.each([
    ['screen_pixel_size', new THREE.Vector2(1 / 128, 1 / 64)],
    ['time', 1.5],
    ['use_pixel_snap', true],
    ['canvas_modulation', new THREE.Vector4(1, 0.5, 0.25, 1)],
  ])('writes %s from the frame', (member, expected) => {
    expect(written()(member)).toEqual(expected);
  });

  it("measures the screen pixel over Godot's viewport inside the target", () => {
    const viewport = { x: 8, y: 4, width: 50, height: 25, scale: 2 };

    expect(written({ ...FRAME, viewport })('screen_pixel_size')).toEqual(new THREE.Vector2(1 / 50, 1 / 25));
  });

  it("gives the draw Godot's viewport as its top-left and viewport pixels per target pixel", () => {
    const draw = transpileCanvasItem(DEFAULT_CANVAS_SHADER).draw('quad');
    writeCanvasBindings(draw, { ...FRAME, viewport: { x: 8, y: 4, width: 50, height: 25, scale: 2 } });

    expect(draw.viewportInTarget.value.toArray()).toEqual([8, 4, 0.5, 0.5]);
  });

  it('writes no light and keeps the vertex colours as they are', () => {
    const value = written();

    expect([value('directional_light_count'), value('flags')]).toEqual([0, 0]);
  });

  it('turns the vertex colours linear for a render target with linear colours', () => {
    expect(written({ ...FRAME, usesLinearColors: true })('flags')).toBe(1);
  });

  it('writes the CanvasModulate colour linear for a render target with linear colours', () => {
    const modulation = written({ ...FRAME, usesLinearColors: true })('canvas_modulation') as THREE.Vector4;

    expect(modulation.toArray().map((channel) => channel.toFixed(4))).toEqual([
      '1.0000',
      '0.2140',
      '0.0509',
      '1.0000',
    ]);
  });
});

describe('writeCanvasData', () => {
  it('writes a new frame into the values of the last one', () => {
    const block = canvasDataBlock();
    writeCanvasData(block, FRAME);
    const { canvasTransform, screenTransform, canvasModulation } = block;

    writeCanvasData(block, { ...FRAME, width: 64, canvasTransform: TRANSFORM2D_IDENTITY });

    expect([block.canvasTransform, block.screenTransform, block.canvasModulation]).toEqual([
      canvasTransform,
      screenTransform,
      canvasModulation,
    ]);
    expect(through(block.canvasTransform, 3, 5)).toEqual([3, 5]);
  });
});

describe('bindCanvasData', () => {
  it('binds one block to the draws of two items, so one write reaches both', () => {
    const block = canvasDataBlock();
    const draws = [1, 2].map(() => transpileCanvasItem(DEFAULT_CANVAS_SHADER).draw('quad'));
    for (const draw of draws) bindCanvasData(draw, block);

    writeCanvasData(block, FRAME);

    const transforms = draws.map(
      (draw) => (draw.uniforms.get('canvas_data.canvas_transform') as UniformNode<unknown>).value
    );
    expect(transforms.map((matrix) => through(matrix, 3, 5))).toEqual([
      [16, 6],
      [16, 6],
    ]);
  });
});

describe('the canvas transform matrix', () => {
  it('maps a point as Transform2D.xform does', () => {
    const value = written({ ...FRAME, canvasTransform: { a: 0, b: 1, c: -1, d: 0, tx: 4, ty: 2 } });

    expect(through(value('canvas_transform'), 3, 5)).toEqual([-1, 5]);
  });
});
