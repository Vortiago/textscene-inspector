import { describe, expect, it } from 'vitest';
import { EMPTY_AABB } from '../../../godot/math/aabb';
import { UV2_ATTRIBUTE } from '../../../resources/meshes/uv2';
import { buildPrimitiveMeshGeometry, primitiveMeshAabb } from './primitiveMeshGeometry';

const TEXEL_SIZE = 0.2;
/** Four segments round and one ring: vertex 6 sits on the equator, a quarter turn from the seam. */
const COARSE_SPHERE = { radius: '0.5', height: '1.0', radial_segments: '4', rings: '1' };

function sphere(data: Record<string, string> = {}) {
  return { id: 'sphere', type: 'SphereMesh', data: { ...COARSE_SPHERE, ...data } };
}

describe('buildPrimitiveMeshGeometry', () => {
  it.each(['SphereMesh', 'CapsuleMesh'])("carries %s's own tangents, each with w = 1", (type) => {
    const tangent = buildPrimitiveMeshGeometry({ id: 'mesh', type, data: {} }, TEXEL_SIZE)!.getAttribute(
      'tangent'
    );

    expect(tangent.itemSize).toBe(4);
    for (let i = 0; i < tangent.count; i++) expect(tangent.getW(i)).toBe(1);
  });

  it("turns Godot's top-down V into three's bottom-up V", () => {
    const uv = buildPrimitiveMeshGeometry(sphere(), TEXEL_SIZE)!.getAttribute('uv');

    expect([uv.getX(0), uv.getY(0)]).toEqual([0, 1]);
  });

  it('carries UV2 as uv1, padded by uv2_padding texels of the project texel size', () => {
    // 3.14159 texels of size 1 pad a circumference of π: U halves round the centre, V thirds.
    const data = { add_uv2: 'true', uv2_padding: String(Math.PI) };

    const uv2 = buildPrimitiveMeshGeometry(sphere(data), 1)!.getAttribute(UV2_ATTRIBUTE);

    expect(uv2.getX(6)).toBeCloseTo(0.125, 6);
    expect(uv2.getY(6)).toBeCloseTo(1 / 6, 6);
  });

  it('carries no uv1 without add_uv2', () => {
    expect(buildPrimitiveMeshGeometry(sphere(), TEXEL_SIZE)!.getAttribute(UV2_ATTRIBUTE)).toBeUndefined();
  });

  it('is null for a type with no slice here', () => {
    expect(buildPrimitiveMeshGeometry({ id: 'text', type: 'TextMesh', data: {} }, TEXEL_SIZE)).toBeNull();
  });
});

describe('primitiveMeshAabb', () => {
  it('bounds the vertices a BoxMesh builds', () => {
    const aabb = primitiveMeshAabb({ id: 'box', type: 'BoxMesh', data: { size: 'Vector3(2, 4, 6)' } });
    expect(aabb).toEqual({ position: { x: -1, y: -2, z: -3 }, size: { x: 2, y: 4, z: 6 } });
  });

  it('bounds a hemisphere from its flat base to the top of its dome', () => {
    const aabb = primitiveMeshAabb(sphere({ height: '0.5', is_hemisphere: 'true' }))!;

    expect(aabb.position.y).toBe(0);
    expect(aabb.size.y).toBeCloseTo(0.5, 6);
  });

  it('takes a custom box over the vertices', () => {
    const data = { custom_aabb: 'AABB(-5, -5, -5, 10, 10, 10)' };
    expect(primitiveMeshAabb({ id: 'box', type: 'BoxMesh', data })?.size).toEqual({ x: 10, y: 10, z: 10 });
  });

  it('is AABB() for a mesh Godot builds no surface for', () => {
    const data = { inner_radius: '1.0', outer_radius: '1.0' };
    expect(primitiveMeshAabb({ id: 'torus', type: 'TorusMesh', data })).toBe(EMPTY_AABB);
  });

  it('is unknown for a type with no slice here', () => {
    expect(primitiveMeshAabb({ id: 'text', type: 'TextMesh', data: {} })).toBeNull();
  });
});
