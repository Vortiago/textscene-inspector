import * as THREE from 'three';
import type { UniformNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import {
  attributesGeometry,
  attributesObject,
  attributesVariant,
  meshConstants,
  polygonCommand,
  polygonConstants,
  primitiveObject,
  triangleArrayCommand,
} from './canvasAttributes.js';
import { DEFAULT_CANVAS_SHADER, transpileCanvasItem } from './transpileCanvas.js';

const ITEM = {
  transform: { a: 2, b: 0, c: 0, d: 2, tx: 5, ty: 7 },
  finalModulate: { r: 0.5, g: 1, b: 1, a: 0.5 },
};
const RED = { r: 1, g: 0, b: 0, a: 1 };
const SQUARE = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 },
];

const arrayOf = (geometry: THREE.BufferGeometry, name: string) => [...geometry.getAttribute(name).array];

describe('polygonCommand', () => {
  it('cuts the outline into triangles', () => {
    expect(polygonCommand(SQUARE, [], []).indices).toHaveLength(6);
  });

  it('refuses an outline with no triangle', () => {
    expect(() => polygonCommand(SQUARE.slice(0, 2), [], [])).toThrow(
      'expected a polygon that triangulates, got 2 points with no triangle'
    );
  });
});

describe('triangleArrayCommand', () => {
  it('refuses two colours for four points with the counts it found', () => {
    expect(() => triangleArrayCommand([0, 1, 2], SQUARE, [RED, RED], [])).toThrow(
      'expected 0, 1 or 4 colours and 0 or 4 UVs, got 2 and 0'
    );
  });
});

describe('attributesGeometry', () => {
  it('writes each point in vertex_attrib and the indices', () => {
    const geometry = attributesGeometry(triangleArrayCommand([0, 1, 2], SQUARE.slice(0, 3), [], []));

    expect([arrayOf(geometry, 'vertex_attrib'), [...geometry.index!.array]]).toEqual([
      [0, 0, 4, 0, 4, 4],
      [0, 1, 2],
    ]);
  });

  it('repeats one colour on every point', () => {
    const geometry = attributesGeometry(triangleArrayCommand([0, 1, 2], SQUARE.slice(0, 3), [RED], []));

    expect(arrayOf(geometry, 'color_attrib')).toEqual([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]);
  });

  it("reads white and a UV of zero for missing arrays, as Godot's default buffers hold", () => {
    const geometry = attributesGeometry(triangleArrayCommand([0, 1, 2], SQUARE.slice(0, 3), [], []));

    expect([
      arrayOf(geometry, 'color_attrib').slice(0, 4),
      arrayOf(geometry, 'uv_attrib').slice(0, 2),
    ]).toEqual([
      [1, 1, 1, 1],
      [0, 0],
    ]);
  });

  it('reads bones as unsigned integers and weights as floats, all zero', () => {
    const geometry = attributesGeometry(triangleArrayCommand([0, 1, 2], SQUARE.slice(0, 3), [], []));

    expect(
      ['bone_attrib', 'weight_attrib'].map((name) => geometry.getAttribute(name).array.constructor.name)
    ).toEqual(['Uint32Array', 'Float32Array']);
  });

  it('is never culled, as it has no position to bound', () => {
    const geometry = attributesGeometry(triangleArrayCommand([0, 1, 2], SQUARE.slice(0, 3), [], []));

    expect(new THREE.Frustum().intersectsSphere(geometry.boundingSphere!)).toBe(true);
  });

  it('refuses a surface with a colour count that is not 0, 1 or one for each point', () => {
    const surface = { primitive: 'triangles' as const, points: SQUARE, colors: [RED, RED], uvs: [] };

    expect(() => attributesGeometry(surface)).toThrow(
      'expected 0, 1 or 4 colours and 0 or 4 UVs, got 2 and 0'
    );
  });
});

describe('attributesVariant', () => {
  it.each([
    ['points', 'attributes_points'],
    ['lines', 'attributes'],
    ['triangles', 'attributes'],
  ] as const)('draws %s with the %s variant', (primitive, variant) => {
    expect(attributesVariant(primitive)).toBe(variant);
  });
});

describe('polygonConstants', () => {
  it("writes the item's transform and modulate", () => {
    expect(polygonConstants(ITEM)).toEqual({ world: ITEM.transform, modulation: ITEM.finalModulate });
  });
});

describe('meshConstants', () => {
  it("places the mesh by its transform inside the item's, and multiplies the modulates", () => {
    const mesh = {
      transform: { a: 1, b: 0, c: 0, d: 1, tx: 1, ty: 2 },
      modulate: { r: 1, g: 0.5, b: 1, a: 1 },
    };

    expect(meshConstants(ITEM, mesh)).toEqual({
      world: { a: 2, b: 0, c: 0, d: 2, tx: 7, ty: 11 },
      modulation: { r: 0.5, g: 0.5, b: 1, a: 0.5 },
    });
  });
});

describe('primitiveObject', () => {
  const geometry = () => attributesGeometry(triangleArrayCommand([0, 1, 2, 3], SQUARE, [], []));
  const material = new THREE.MeshBasicMaterial();

  it.each([
    ['points', 'Points'],
    ['lines', 'LineSegments'],
    ['line_strip', 'Line'],
    ['triangles', 'Mesh'],
  ] as const)('draws %s as a three %s', (primitive, type) => {
    expect(primitiveObject(primitive, geometry(), material).type).toBe(type);
  });

  it('draws a strip as its triangles, every second one turned', () => {
    const strip = primitiveObject('triangle_strip', geometry(), material) as THREE.Mesh;

    expect([...strip.geometry.index!.array]).toEqual([0, 1, 2, 1, 3, 2]);
  });

  it('leaves the strip geometry it reads as it was, so a second object reads the same strip', () => {
    const strip = geometry();

    primitiveObject('triangle_strip', strip, material);

    expect([...strip.index!.array]).toEqual([0, 1, 2, 3]);
  });
});

describe('attributesObject', () => {
  it('writes the push constants of the object before it draws', () => {
    const draw = transpileCanvasItem(DEFAULT_CANVAS_SHADER).draw('attributes');
    const geometry = attributesGeometry(polygonCommand(SQUARE, [], []));
    const object = attributesObject(draw, geometry, 'triangles', polygonConstants(ITEM));
    const hook = draw.uniforms.get('params.world_x') as UniformNode<unknown> & {
      update(frame: { object: THREE.Object3D }): void;
    };

    hook.update({ object });

    expect((draw.uniforms.get('params.world_ofs') as UniformNode<unknown>).value).toEqual(
      new THREE.Vector2(5, 7)
    );
  });
});
