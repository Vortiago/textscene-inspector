import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { halfToFloat } from '../../godot/math/halfFloat.js';
import {
  primitiveBatchGeometry,
  primitiveBatchObject,
  primitiveCommand,
  primitiveDraw,
  primitiveInstanceData,
} from './canvasPrimitive.js';
import { DEFAULT_CANVAS_SHADER, transpileCanvasItem } from './transpileCanvas.js';

const ITEM = {
  transform: { a: 1, b: 0, c: 0, d: 1, tx: 5, ty: 7 },
  finalModulate: { r: 0.5, g: 1, b: 1, a: 0.5 },
};
const RED = { r: 1, g: 0, b: 0, a: 1 };
const BLUE = { r: 0, g: 0, b: 1, a: 1 };
const QUAD = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 },
];

/** The floats of a record from float `offset`, `count` of them. */
const floatsOf = (record: ArrayBuffer, offset: number, count: number) => [
  ...new Float32Array(record, offset * 4, count),
];

/** The colour of point `slot` of a record, from its two words of half floats. */
function colorOf(record: ArrayBuffer, slot: number) {
  const [rg, ba] = new Uint32Array(record, (20 + slot * 2) * 4, 2);
  return [rg! & 0xffff, rg! >>> 16, ba! & 0xffff, ba! >>> 16].map(halfToFloat);
}

describe('primitiveCommand', () => {
  it('repeats the first colour for a point with none, and gives a point with no UV zero', () => {
    const command = primitiveCommand(QUAD.slice(0, 3), [RED], []);

    expect([command.colors, command.uvs[2]]).toEqual([[RED, RED, RED], { x: 0, y: 0 }]);
  });

  it('gives every point white with no colour', () => {
    expect(primitiveCommand(QUAD.slice(0, 2), [], []).colors[1]).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('refuses five points with the count it found', () => {
    expect(() => primitiveCommand([...QUAD, QUAD[0]!], [], [])).toThrow(
      'expected a primitive of 1 to 4 points, got 5'
    );
  });
});

describe('primitiveDraw', () => {
  it.each([
    [1, 'primitive_points', 'points'],
    [2, 'primitive', 'lines'],
    [3, 'primitive', 'triangles'],
    [4, 'primitive', 'triangles'],
  ])('draws %i points with the %s variant as %s', (count, variant, primitive) => {
    expect(primitiveDraw(count)).toEqual({ variant, primitive });
  });

  it('refuses five points', () => {
    expect(() => primitiveDraw(5)).toThrow('expected a primitive of 1 to 4 points, got 5');
  });
});

describe('primitiveInstanceData', () => {
  it('writes the points in attrib_C and attrib_D.xy and the UVs from attrib_D.zw', () => {
    const uvs = [
      { x: 0.1, y: 0.2 },
      { x: 0.3, y: 0.4 },
      { x: 0.5, y: 0.6 },
    ];
    const [record] = primitiveInstanceData(primitiveCommand(QUAD.slice(0, 3), [], uvs), ITEM);

    expect([floatsOf(record!, 8, 6), floatsOf(record!, 14, 6).map((uv) => uv.toFixed(1))]).toEqual([
      [0, 0, 4, 0, 4, 4],
      ['0.1', '0.2', '0.3', '0.4', '0.5', '0.6'],
    ]);
  });

  it('writes each colour times the item modulate as half floats', () => {
    const [record] = primitiveInstanceData(primitiveCommand(QUAD.slice(0, 2), [RED, BLUE], []), ITEM);

    expect([colorOf(record!, 0), colorOf(record!, 1)]).toEqual([
      [0.5, 0, 0, 0.5],
      [0, 0, 1, 0.5],
    ]);
  });

  it('writes a colour linear for a render target with linear colours', () => {
    const grey = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
    const linear = { ...ITEM, finalModulate: { r: 1, g: 1, b: 1, a: 1 }, usesLinearColors: true };
    const [record] = primitiveInstanceData(primitiveCommand([QUAD[0]!], [grey], []), linear);

    expect(colorOf(record!, 0).map((channel) => channel.toFixed(3))).toEqual([
      '0.214',
      '0.214',
      '0.214',
      '1.000',
    ]);
  });

  it('draws a quad as the triangles of points 0, 1, 2 and of points 0, 2, 3', () => {
    const records = primitiveInstanceData(primitiveCommand(QUAD, [], []), ITEM);

    expect(records.map((record) => floatsOf(record, 8, 6))).toEqual([
      [0, 0, 4, 0, 4, 4],
      [0, 0, 4, 4, 0, 4],
    ]);
  });
});

describe('primitiveBatchGeometry', () => {
  const records = primitiveInstanceData(primitiveCommand(QUAD.slice(0, 3), [], []), ITEM);

  it.each([
    [1, [0]],
    [2, [0, 1]],
    [3, [0, 1, 2]],
    [4, [0, 1, 2]],
  ])('draws the first indices of the quad for %i points', (count, indices) => {
    expect([...primitiveBatchGeometry(records, count).index!.array]).toEqual(indices);
  });

  it('refuses a batch of no points', () => {
    expect(() => primitiveBatchGeometry(records, 0)).toThrow(
      'expected a batch of primitives of 1 to 4 points, got 0'
    );
  });

  it('reads attrib_A to attrib_E as floats and attrib_F to attrib_H as unsigned integers', () => {
    const geometry = primitiveBatchGeometry(records, 3);
    const arrayOf = (name: string) =>
      (geometry.getAttribute(name) as unknown as { data: { array: object } }).data.array;

    expect([arrayOf('attrib_E'), arrayOf('attrib_F')].map((array) => array.constructor.name)).toEqual([
      'Float32Array',
      'Uint32Array',
    ]);
  });
});

describe('primitiveBatchObject', () => {
  const records = primitiveInstanceData(primitiveCommand(QUAD.slice(0, 1), [], []), ITEM);

  it('draws the points of a shader that names POINT_SIZE as the six corners of two triangles', () => {
    const draw = transpileCanvasItem('shader_type canvas_item;\nvoid vertex() { POINT_SIZE = 4.0; }\n').draw(
      'primitive_points'
    );
    const object = primitiveBatchObject(draw, records, 1) as THREE.Mesh;

    expect([object.isMesh, [...object.geometry.index!.array]]).toEqual([true, [0, 1, 2, 3, 4, 5]]);
  });

  it("draws three's points for a shader that leaves POINT_SIZE", () => {
    const draw = transpileCanvasItem(DEFAULT_CANVAS_SHADER).draw('primitive_points');

    expect(primitiveBatchObject(draw, records, 1)).toBeInstanceOf(THREE.Points);
  });
});
