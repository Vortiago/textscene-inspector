import { describe, expect, it } from 'vitest';
import { buildPrismMeshSurface } from '../prismmesh/build';
import { decodePrismMesh } from '../prismmesh/decode';
import { subResource } from '../../../testing/subResource';
import { meshContentKey } from '../meshSource';
import { isPrimitiveMeshType, primitiveMeshSurface } from './surface';
import { COARSE_TUBE, expectClose, scopedMesh, vertexOf } from './surface.testkit';

const TEXEL_SIZE = 0.2;
/** Four segments round and one ring: vertex 6 sits on the equator, a quarter turn from the seam. */
const COARSE_SPHERE = { radius: '0.5', height: '1.0', radial_segments: '4', rings: '1' };

function sphere(data: Record<string, string> = {}) {
  return { id: 'sphere', type: 'SphereMesh', data: { ...COARSE_SPHERE, ...data } };
}

describe('primitiveMeshSurface', () => {
  it('under flip_faces, negates the normals and swaps the first two corners of each triangle', () => {
    const plain = primitiveMeshSurface(scopedMesh(sphere()), TEXEL_SIZE)!;
    const flipped = primitiveMeshSurface(scopedMesh(sphere({ flip_faces: 'true' })), TEXEL_SIZE)!;

    expect(Array.from(flipped.indices).slice(0, 6)).toEqual([1, 0, 5, 6, 1, 5]);
    expect(Array.from(flipped.normals!.slice(18, 21))).toEqual(
      Array.from(plain.normals!.slice(18, 21), (n) => -n)
    );
  });

  it('under flip_faces, keeps the positions, the UVs and the tangents', () => {
    const plain = primitiveMeshSurface(scopedMesh(sphere()), TEXEL_SIZE)!;
    const flipped = primitiveMeshSurface(scopedMesh(sphere({ flip_faces: 'true' })), TEXEL_SIZE)!;

    expect(flipped.positions).toEqual(plain.positions);
    expect(flipped.uvs).toEqual(plain.uvs);
    expect(flipped.tangents).toEqual(plain.tangents);
  });

  it("hands on a builder's surface as it is", () => {
    const data = { size: 'Vector3(2, 1, 1)', left_to_right: '0.25' };

    const surface = primitiveMeshSurface(scopedMesh({ id: 'prism', type: 'PrismMesh', data }), TEXEL_SIZE)!;

    expect(surface).toEqual(buildPrismMeshSurface(decodePrismMesh(data), null));
  });

  it('is null for a type with no slice here', () => {
    expect(
      primitiveMeshSurface(scopedMesh({ id: 'text', type: 'TextMesh', data: {} }), TEXEL_SIZE)
    ).toBeNull();
  });
});

describe('primitiveMeshSurface UV2', () => {
  // Godot 4.6.3 writes each expected UV2 for the same properties.
  it("makes a PlaneMesh's UV2 from its UV, scaled by uv2_padding over the lightmap size hint", () => {
    const data = { add_uv2: 'true', uv2_padding: '7.0', size: 'Vector2(3, 1.3)' };

    const surface = primitiveMeshSurface(scopedMesh({ id: 'plane', type: 'PlaneMesh', data }), TEXEL_SIZE)!;

    expectClose(vertexOf(surface.uv2s, 0, 2), [0.681818, 0.461538]);
  });

  it("makes a QuadMesh's UV2 from its own default size", () => {
    const surface = primitiveMeshSurface(
      scopedMesh({ id: 'quad', type: 'QuadMesh', data: { add_uv2: 'true' } }),
      TEXEL_SIZE
    )!;

    expectClose(vertexOf(surface.uv2s, 0, 2), [0.714286, 0.714286]);
  });

  it('scales by a stored lightmap_size_hint that no change follows', () => {
    const data = { add_uv2: 'true', lightmap_size_hint: 'Vector2i(50, 60)' };

    const surface = primitiveMeshSurface(scopedMesh({ id: 'plane', type: 'PlaneMesh', data }), TEXEL_SIZE)!;

    expectClose(vertexOf(surface.uv2s, 0, 2), [0.96, 0.966667]);
  });

  it('makes no UV2 without add_uv2', () => {
    expect(
      primitiveMeshSurface(scopedMesh({ id: 'plane', type: 'PlaneMesh', data: {} }), TEXEL_SIZE)!.uv2s
    ).toBeUndefined();
  });
});

describe('primitiveMeshSurface TubeTrailMesh', () => {
  /** Two sections of length 1 with one ring each, four steps round: the vertex of the bottom row on +Z is 10. */
  const SHRINKING_BODY = { _data: '[Vector2(0, 1), 0.0, 0.0, 0, 0, Vector2(1, 0.2), 0.0, 0.0, 0, 0]' };

  function tube(data: Record<string, string> = {}) {
    return { id: 'tube', type: 'TubeTrailMesh', data: { ...COARSE_TUBE, ...data } };
  }

  it('scales the rows by the Curve the mesh names in the tables it holds', () => {
    const mesh = scopedMesh(
      tube({ curve: 'SubResource("shrink")' }),
      subResource('Curve', 'shrink', SHRINKING_BODY)
    );

    expectClose(vertexOf(primitiveMeshSurface(mesh, TEXEL_SIZE)!.positions, 10), [0, -1, 0.1]);
  });

  it('draws the tube unscaled when the tables hold no such Curve', () => {
    const mesh = scopedMesh(tube({ curve: 'SubResource("shrink")' }));

    expectClose(vertexOf(primitiveMeshSurface(mesh, TEXEL_SIZE)!.positions, 10), [0, -1, 0.5]);
  });

  it("makes the UV2 from the UV over Godot's reference size of 1024 texels without a lightmap_size_hint", () => {
    const surface = primitiveMeshSurface(scopedMesh(tube({ add_uv2: 'true' })), TEXEL_SIZE)!;

    // Vertex 6 has UV (0.25, 0.25); two texels of 1024 leave a scale of 0.998046875.
    expectClose(vertexOf(surface.uv2s, 6, 2), [0.249512, 0.249512]);
  });

  it('measures the UV2 padding against an authored lightmap_size_hint', () => {
    const data = { add_uv2: 'true', lightmap_size_hint: 'Vector2i(50, 100)' };

    const surface = primitiveMeshSurface(scopedMesh(tube(data)), TEXEL_SIZE)!;

    expectClose(vertexOf(surface.uv2s, 6, 2), [0.24, 0.245]);
  });
});

describe('meshContentKey', () => {
  const curveRef = { curve: 'SubResource("shrink")' };
  const mesh = { id: 'tube', type: 'TubeTrailMesh', data: curveRef };

  it("changes when the body of the mesh's Curve changes", () => {
    const before = scopedMesh(mesh, subResource('Curve', 'shrink', { bake_resolution: '10' }));
    const after = scopedMesh(mesh, subResource('Curve', 'shrink', { bake_resolution: '11' }));

    expect(meshContentKey(after)).not.toBe(meshContentKey(before));
  });

  it('is the same for equal content, whichever objects hold it', () => {
    const curve = () => subResource('Curve', 'shrink', { bake_resolution: '10' });

    expect(meshContentKey(scopedMesh({ ...mesh }, curve()))).toBe(
      meshContentKey(scopedMesh({ ...mesh }, curve()))
    );
  });

  it('ignores a sub-resource the mesh does not name', () => {
    const before = scopedMesh(mesh, subResource('Curve', 'other', { bake_resolution: '10' }));
    const after = scopedMesh(mesh, subResource('Curve', 'other', { bake_resolution: '11' }));

    expect(meshContentKey(after)).toBe(meshContentKey(before));
  });

  it('follows only the mesh itself for a type that names no sub-resource to build', () => {
    const material = subResource('StandardMaterial3D', 'm', {});

    expect(meshContentKey(scopedMesh(sphere({ material: 'SubResource("m")' }), material))).toBe(
      meshContentKey(scopedMesh(sphere({ material: 'SubResource("m")' })))
    );
  });
});

describe('primitiveMeshSurface sharing', () => {
  it('builds a resource once per texel size', () => {
    const resource = sphere();

    expect(primitiveMeshSurface(scopedMesh(resource), TEXEL_SIZE)).toBe(
      primitiveMeshSurface(scopedMesh(resource), TEXEL_SIZE)
    );
  });

  it('builds again for another texel size', () => {
    const resource = sphere({ add_uv2: 'true' });

    expect(primitiveMeshSurface(scopedMesh(resource), 1)).not.toBe(
      primitiveMeshSurface(scopedMesh(resource), TEXEL_SIZE)
    );
  });

  it('builds again for a fresh resource with the same content (edge case)', () => {
    expect(primitiveMeshSurface(scopedMesh(sphere()), TEXEL_SIZE)).not.toBe(
      primitiveMeshSurface(scopedMesh(sphere()), TEXEL_SIZE)
    );
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
