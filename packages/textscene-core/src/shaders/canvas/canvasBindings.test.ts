import * as THREE from 'three';
import type { UniformNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { TRANSFORM2D_IDENTITY } from '../../godot/math/transform2d.js';
import { type CanvasFrame, transform2DMatrix, writeCanvasBindings } from './canvasBindings.js';
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

  it('writes the pixel size, the time, the pixel snap and the canvas modulation', () => {
    const value = written();

    expect([
      value('screen_pixel_size'),
      value('time'),
      value('use_pixel_snap'),
      value('canvas_modulation'),
    ]).toEqual([new THREE.Vector2(1 / 128, 1 / 64), 1.5, true, new THREE.Vector4(1, 0.5, 0.25, 1)]);
  });

  it('writes no light and keeps the vertex colours as they are', () => {
    const value = written();

    expect([value('directional_light_count'), value('flags')]).toEqual([0, 0]);
  });
});

describe('transform2DMatrix', () => {
  it('maps a point as Transform2D.xform does', () => {
    expect(through(transform2DMatrix({ a: 0, b: 1, c: -1, d: 0, tx: 4, ty: 2 }), 3, 5)).toEqual([-1, 5]);
  });
});
