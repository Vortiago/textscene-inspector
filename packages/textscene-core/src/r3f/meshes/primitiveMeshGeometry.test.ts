import { describe, expect, it } from 'vitest';
import { EMPTY_AABB } from '../../godot/math/aabb';
import { UV2_ATTRIBUTE } from '../../resources/meshes/uv2';
import { primitiveMeshGeometry, primitiveMeshAabb } from './primitiveMeshGeometry';
import { COARSE_TUBE, curveEndingAt, scopedMesh } from '../../resources/meshes/primitivemesh/surface.testkit';
import { subResource } from '../../testing/subResource';

const TEXEL_SIZE = 0.2;
/** Four segments round and one ring: vertex 6 sits on the equator, a quarter turn from the seam. */
const COARSE_SPHERE = { radius: '0.5', height: '1.0', radial_segments: '4', rings: '1' };

/** Every PrimitiveMesh type, each built from a port of its Godot `create_mesh_array`. */
const PRIMITIVE_TYPES = [
  'BoxMesh',
  'SphereMesh',
  'PlaneMesh',
  'QuadMesh',
  'CylinderMesh',
  'CapsuleMesh',
  'TorusMesh',
  'PrismMesh',
];

function sphere(data: Record<string, string> = {}) {
  return { id: 'sphere', type: 'SphereMesh', data: { ...COARSE_SPHERE, ...data } };
}

describe('primitiveMeshGeometry sharing', () => {
  // One PrimitiveMesh resource is one mesh in Godot, whichever MeshLibrary item or node draws it.
  it('gives every holder of equal content one geometry', () => {
    const data = { radius: '0.75' };
    expect(primitiveMeshGeometry(scopedMesh(sphere(data)), TEXEL_SIZE)).toBe(
      primitiveMeshGeometry(scopedMesh(sphere(data)), TEXEL_SIZE)
    );
  });

  it('builds again once the shared geometry is disposed', () => {
    const data = { radius: '0.625' };
    const first = primitiveMeshGeometry(scopedMesh(sphere(data)), TEXEL_SIZE)!;
    first.dispose();
    expect(primitiveMeshGeometry(scopedMesh(sphere(data)), TEXEL_SIZE)).not.toBe(first);
  });

  it('builds apart for another texel size, which moves UV2', () => {
    const data = { radius: '0.875' };
    expect(primitiveMeshGeometry(scopedMesh(sphere(data)), TEXEL_SIZE)).not.toBe(
      primitiveMeshGeometry(scopedMesh(sphere(data)), 0.4)
    );
  });
});

describe('primitiveMeshGeometry over a mesh that names a Curve', () => {
  const tube = {
    id: 'tube',
    type: 'TubeTrailMesh',
    data: { ...COARSE_TUBE, curve: 'SubResource("c")' },
  };
  const curve = (end: string) => subResource('Curve', 'c', curveEndingAt(end));

  it('gives every holder of an equal mesh and an equal Curve one geometry', () => {
    expect(primitiveMeshGeometry(scopedMesh({ ...tube }, curve('0.25')), TEXEL_SIZE)).toBe(
      primitiveMeshGeometry(scopedMesh({ ...tube }, curve('0.25')), TEXEL_SIZE)
    );
  });

  it('builds apart once the body of the Curve changes', () => {
    expect(primitiveMeshGeometry(scopedMesh({ ...tube }, curve('0.25')), TEXEL_SIZE)).not.toBe(
      primitiveMeshGeometry(scopedMesh({ ...tube }, curve('0.75')), TEXEL_SIZE)
    );
  });

  it('bounds the mesh by the radii the Curve gives', () => {
    const { size } = primitiveMeshAabb(scopedMesh({ ...tube }, curve('3')))!;

    expect([size.x, size.y, size.z]).toEqual([3, 2, 3].map((side) => expect.closeTo(side, 5)));
  });
});

describe('primitiveMeshGeometry', () => {
  it.each(PRIMITIVE_TYPES)("carries %s's own tangents, each with w = 1", (type) => {
    const tangent = primitiveMeshGeometry(
      scopedMesh({ id: 'mesh', type, data: {} }),
      TEXEL_SIZE
    )!.getAttribute('tangent');

    expect(tangent.itemSize).toBe(4);
    for (let i = 0; i < tangent.count; i++) expect(tangent.getW(i)).toBe(1);
  });

  it("turns Godot's top-down V into three's bottom-up V", () => {
    const uv = primitiveMeshGeometry(scopedMesh(sphere()), TEXEL_SIZE)!.getAttribute('uv');

    expect([uv.getX(0), uv.getY(0)]).toEqual([0, 1]);
  });

  it('carries UV2 as uv1, padded by uv2_padding texels of the project texel size', () => {
    // 3.14159 texels of size 1 pad a circumference of π: U halves round the centre, V thirds.
    const data = { add_uv2: 'true', uv2_padding: String(Math.PI) };

    const uv2 = primitiveMeshGeometry(scopedMesh(sphere(data)), 1)!.getAttribute(UV2_ATTRIBUTE);

    expect(uv2.getX(6)).toBeCloseTo(0.125, 6);
    expect(uv2.getY(6)).toBeCloseTo(1 / 6, 6);
  });

  it.each(PRIMITIVE_TYPES)("carries %s's UV2 as uv1 under add_uv2", (type) => {
    const geometry = primitiveMeshGeometry(
      scopedMesh({ id: 'mesh', type, data: { add_uv2: 'true' } }),
      TEXEL_SIZE
    )!;

    expect(geometry.getAttribute(UV2_ATTRIBUTE).count).toBe(geometry.getAttribute('position').count);
  });

  it.each(PRIMITIVE_TYPES)('carries no uv1 on a %s without add_uv2', (type) => {
    const geometry = primitiveMeshGeometry(scopedMesh({ id: 'mesh', type, data: {} }), TEXEL_SIZE)!;

    expect(geometry.getAttribute(UV2_ATTRIBUTE)).toBeUndefined();
  });

  it('is null for a type with no slice here', () => {
    expect(
      primitiveMeshGeometry(scopedMesh({ id: 'text', type: 'TextMesh', data: {} }), TEXEL_SIZE)
    ).toBeNull();
  });
});

describe('primitiveMeshAabb', () => {
  it('bounds the vertices a BoxMesh builds', () => {
    const aabb = primitiveMeshAabb(
      scopedMesh({ id: 'box', type: 'BoxMesh', data: { size: 'Vector3(2, 4, 6)' } })
    );
    expect(aabb).toEqual({ position: { x: -1, y: -2, z: -3 }, size: { x: 2, y: 4, z: 6 } });
  });

  it('bounds a hemisphere from its flat base to the top of its dome', () => {
    const aabb = primitiveMeshAabb(scopedMesh(sphere({ height: '0.5', is_hemisphere: 'true' })))!;

    expect(aabb.position.y).toBe(0);
    expect(aabb.size.y).toBeCloseTo(0.5, 6);
  });

  it('takes a custom box over the vertices', () => {
    const data = { custom_aabb: 'AABB(-5, -5, -5, 10, 10, 10)' };
    expect(primitiveMeshAabb(scopedMesh({ id: 'box', type: 'BoxMesh', data }))?.size).toEqual({
      x: 10,
      y: 10,
      z: 10,
    });
  });

  it('is AABB() for a mesh Godot builds no surface for', () => {
    const data = { inner_radius: '1.0', outer_radius: '1.0' };
    expect(primitiveMeshAabb(scopedMesh({ id: 'torus', type: 'TorusMesh', data }))).toBe(EMPTY_AABB);
  });

  it('is unknown for a type with no slice here', () => {
    expect(primitiveMeshAabb(scopedMesh({ id: 'text', type: 'TextMesh', data: {} }))).toBeNull();
  });
});
