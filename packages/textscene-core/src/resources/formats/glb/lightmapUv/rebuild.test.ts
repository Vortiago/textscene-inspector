import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { rebuildSurfaces } from './rebuild';
import { parseUnwrapCache } from './unwrapCache';
import { unwrapInput } from './unwrapInput';
import { demoBytes, demoMeshSurfaces } from './testing/globalIllumination';
import { orderedCornerDigest, triangleSetDigest } from './testing/godotCorners';

const UNIT_SCALE = { scale: [1, 1, 1], vertexScale: 1 } as const;
const DEMO_TEXEL_SIZE = 0.2;

async function rebuiltDemo(file: string): Promise<THREE.BufferGeometry[]> {
  const surfaces = await demoMeshSurfaces(file);
  const [entry] = parseUnwrapCache(demoBytes(`${file}.unwrap_cache`));
  const rebuilt = rebuildSurfaces(surfaces, unwrapInput(surfaces, UNIT_SCALE, DEMO_TEXEL_SIZE)!, entry!);
  return rebuilt.filter((geometry): geometry is THREE.BufferGeometry => geometry !== null);
}

function quad(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3)
  );
  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(Array<number[]>(4).fill([0, 0, 1]).flat(), 3)
  );
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute([9, 9, 9, 9, 9, 9, 9, 9], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

/** An entry that unwraps `quad`'s two triangles, in Godot's winding, onto four output vertices. */
const QUAD_ENTRY = {
  hash: '',
  sourceVertices: Int32Array.from([0, 1, 2, 3]),
  uvs: Float32Array.from([0, 0, 0.5, 0, 0.5, 0.5, 0, 0.5]),
  indices: Int32Array.from([0, 2, 1, 0, 3, 2]),
};

describe('rebuildSurfaces', () => {
  it("gives the cube Godot's imported corners, in order", async () => {
    expect(orderedCornerDigest(await rebuiltDemo('cube.glb'))).toBe('a60e081e9297b5f4d7c5ca5cf6f8b321');
  });

  it("gives zdm2 Godot's imported triangles, as a set", async () => {
    expect(triangleSetDigest(await rebuiltDemo('zdm2.glb'))).toBe('6e1ba5b4d7c70f7ad853882741cb49be');
  });

  it("replaces the surface's own UV2 and keeps its other attributes", () => {
    const surface = quad();
    const [rebuilt] = rebuildSurfaces(
      [surface],
      unwrapInput([surface], UNIT_SCALE, DEMO_TEXEL_SIZE)!,
      QUAD_ENTRY
    );

    expect(Array.from(rebuilt!.getAttribute('uv1').array)).toEqual([0, 0, 0.5, 0, 0.5, 0.5, 0, 0.5]);
    expect(Array.from(rebuilt!.getAttribute('normal').array)).toEqual(
      Array<number[]>(4).fill([0, 0, 1]).flat()
    );
  });

  it('keeps a normalised attribute at its stored integers', () => {
    const surface = quad();
    surface.setAttribute('color', new THREE.Uint8BufferAttribute(Array<number>(12).fill(255), 3, true));
    const [rebuilt] = rebuildSurfaces(
      [surface],
      unwrapInput([surface], UNIT_SCALE, DEMO_TEXEL_SIZE)!,
      QUAD_ENTRY
    );

    expect(Array.from(rebuilt!.getAttribute('color').array)).toEqual(Array<number>(12).fill(255));
  });

  it('refuses an entry whose triangle names a vertex past the input (edge case)', () => {
    const surface = quad();
    const corrupt = { ...QUAD_ENTRY, sourceVertices: Int32Array.from([0, 1, 2, 7]) };

    expect(() =>
      rebuildSurfaces([surface], unwrapInput([surface], UNIT_SCALE, DEMO_TEXEL_SIZE)!, corrupt)
    ).toThrow('unwrap cache: output vertex 3 names input vertex 7, the input has 4');
  });

  it('refuses an entry whose triangle spans two surfaces (edge case)', () => {
    const [first, second] = [quad(), quad()];
    const input = unwrapInput([first, second], UNIT_SCALE, DEMO_TEXEL_SIZE)!;
    // Output vertex 4 is the second surface's first input vertex.
    const spanning = { ...QUAD_ENTRY, sourceVertices: Int32Array.from([0, 1, 2, 4]) };

    expect(() => rebuildSurfaces([first, second], input, spanning)).toThrow(
      'unwrap cache: a triangle spans surfaces 0, 1 and 0'
    );
  });

  it("drops a last surface without normals, as Godot's rebuilt mesh lacks it", () => {
    const surface = quad();
    const bare = quad().deleteAttribute('normal');
    const input = unwrapInput([surface, bare], UNIT_SCALE, DEMO_TEXEL_SIZE)!;

    expect(rebuildSurfaces([surface, bare], input, QUAD_ENTRY)[1]).toBeNull();
  });
});
