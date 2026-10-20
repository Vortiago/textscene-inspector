import { describe, expect, it } from 'vitest';
import { buildPrismMeshSurface } from '../prismmesh/build';
import { decodePrismMesh } from '../prismmesh/decode';
import { isPrimitiveMeshType, primitiveMeshSurface } from './surface';
import { expectClose, vertexOf } from './surface.testkit';

const TEXEL_SIZE = 0.2;
/** Four segments round and one ring: vertex 6 sits on the equator, a quarter turn from the seam. */
const COARSE_SPHERE = { radius: '0.5', height: '1.0', radial_segments: '4', rings: '1' };

function sphere(data: Record<string, string> = {}) {
  return { id: 'sphere', type: 'SphereMesh', data: { ...COARSE_SPHERE, ...data } };
}

describe('primitiveMeshSurface', () => {
  it('under flip_faces, negates the normals and swaps the first two corners of each triangle', () => {
    const plain = primitiveMeshSurface(sphere(), TEXEL_SIZE)!;
    const flipped = primitiveMeshSurface(sphere({ flip_faces: 'true' }), TEXEL_SIZE)!;

    expect(Array.from(flipped.indices).slice(0, 6)).toEqual([1, 0, 5, 6, 1, 5]);
    expect(Array.from(flipped.normals!.slice(18, 21))).toEqual(
      Array.from(plain.normals!.slice(18, 21), (n) => -n)
    );
  });

  it('under flip_faces, keeps the positions, the UVs and the tangents', () => {
    const plain = primitiveMeshSurface(sphere(), TEXEL_SIZE)!;
    const flipped = primitiveMeshSurface(sphere({ flip_faces: 'true' }), TEXEL_SIZE)!;

    expect(flipped.positions).toEqual(plain.positions);
    expect(flipped.uvs).toEqual(plain.uvs);
    expect(flipped.tangents).toEqual(plain.tangents);
  });

  it("hands on a ported builder's surface as it is", () => {
    const data = { size: 'Vector3(2, 1, 1)', left_to_right: '0.25' };

    const surface = primitiveMeshSurface({ id: 'prism', type: 'PrismMesh', data }, TEXEL_SIZE)!;

    expect(surface).toEqual(buildPrismMeshSurface(decodePrismMesh(data), null));
  });

  it('is null for a type with no slice here', () => {
    expect(primitiveMeshSurface({ id: 'text', type: 'TextMesh', data: {} }, TEXEL_SIZE)).toBeNull();
  });
});

describe('primitiveMeshSurface UV2', () => {
  // Godot 4.6.3 writes each expected UV2 for the same properties.
  it("makes a PlaneMesh's UV2 from its UV, scaled by uv2_padding over the lightmap size hint", () => {
    const data = { add_uv2: 'true', uv2_padding: '7.0', size: 'Vector2(3, 1.3)' };

    const surface = primitiveMeshSurface({ id: 'plane', type: 'PlaneMesh', data }, TEXEL_SIZE)!;

    expectClose(vertexOf(surface.uv2s, 0, 2), [0.681818, 0.461538]);
  });

  it("makes a QuadMesh's UV2 from its own default size", () => {
    const surface = primitiveMeshSurface(
      { id: 'quad', type: 'QuadMesh', data: { add_uv2: 'true' } },
      TEXEL_SIZE
    )!;

    expectClose(vertexOf(surface.uv2s, 0, 2), [0.714286, 0.714286]);
  });

  it('scales by a stored lightmap_size_hint that no change follows', () => {
    const data = { add_uv2: 'true', lightmap_size_hint: 'Vector2i(50, 60)' };

    const surface = primitiveMeshSurface({ id: 'plane', type: 'PlaneMesh', data }, TEXEL_SIZE)!;

    expectClose(vertexOf(surface.uv2s, 0, 2), [0.96, 0.966667]);
  });

  it('makes no UV2 without add_uv2', () => {
    expect(
      primitiveMeshSurface({ id: 'plane', type: 'PlaneMesh', data: {} }, TEXEL_SIZE)!.uv2s
    ).toBeUndefined();
  });
});

describe('primitiveMeshSurface sharing', () => {
  it('builds a resource once per texel size', () => {
    const resource = sphere();

    expect(primitiveMeshSurface(resource, TEXEL_SIZE)).toBe(primitiveMeshSurface(resource, TEXEL_SIZE));
  });

  it('builds again for another texel size', () => {
    const resource = sphere({ add_uv2: 'true' });

    expect(primitiveMeshSurface(resource, 1)).not.toBe(primitiveMeshSurface(resource, TEXEL_SIZE));
  });

  it('builds again for a fresh resource with the same content (edge case)', () => {
    expect(primitiveMeshSurface(sphere(), TEXEL_SIZE)).not.toBe(primitiveMeshSurface(sphere(), TEXEL_SIZE));
  });
});

describe('isPrimitiveMeshType', () => {
  it('knows every PrimitiveMesh type a slice builds', () => {
    expect(isPrimitiveMeshType('SphereMesh')).toBe(true);
    expect(isPrimitiveMeshType('QuadMesh')).toBe(true);
  });

  it('refuses a name an object inherits (edge case)', () => {
    expect(isPrimitiveMeshType('constructor')).toBe(false);
  });
});
