/**
 * CSGMesh3D's brush: the port of `CSGMesh3D::_build_brush` over each mesh source. The two-box
 * `.tres` is the fixture Godot 4.6.3 saved, so its bytes are Godot's own.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { parseTresFile, type ParsedResource } from '../../../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../../../parser/types';
import { fixturesDir } from '../../../../parser/testing/parserKit';
import type { CsgSolid } from '../../../../r3f/csg/csgRegistration';
import { csgGeometryContext } from '../../../../r3f/csg/testing/csgGeometryContext';
import { wallQuadSurfaces } from '../../../../resources/testing/arrayMeshSurfaces';
import { csgMesh3DGeometry, csgMesh3DGeometryKey, csgMesh3DReadsFiles } from './csgGeometry';

const TWO_BOXES_PATH = 'res://two-boxes.tres';
const BOX_PATH = 'res://box.tres';
const EXT: TscnExternalResource[] = [
  { id: '1', type: 'ArrayMesh', path: TWO_BOXES_PATH },
  { id: '2', type: 'BoxMesh', path: BOX_PATH },
  { id: '3', type: 'PackedScene', path: 'res://rock.glb' },
];

function fixture(name: string): ParsedResource {
  return parseTresFile(readFileSync(join(fixturesDir(), name), 'utf8'));
}

const FILES = {
  [TWO_BOXES_PATH]: fixture('unit-csg-mesh-sources-two-boxes.tres'),
  [BOX_PATH]: fixture('unit-csg-mesh-sources-box.tres'),
};

const INLINE_BOX: TscnInternalResource = { id: 'Box', type: 'BoxMesh', data: { size: 'Vector3(2, 2, 2)' } };
const INLINE_CAPSULE: TscnInternalResource = { id: 'Capsule', type: 'CapsuleMesh', data: {} };
const INLINE_QUADS: TscnInternalResource = {
  id: 'Quads',
  type: 'ArrayMesh',
  data: {
    _surfaces: wallQuadSurfaces({ material: 'SubResource("Red")' }, { material: 'SubResource("Red")' }),
  },
};

const CTX = csgGeometryContext({
  internalResources: [INLINE_BOX, INLINE_CAPSULE, INLINE_QUADS],
  externalResources: EXT,
  files: FILES,
});

function build(mesh: string, overrides: Record<string, unknown> = {}, ctx = CTX): CsgSolid | null {
  return csgMesh3DGeometry({ mesh, flipFaces: false, ...overrides }, ctx);
}

/** Each triangle's three-space front normal: counter-clockwise, as three culls. */
function frontNormals(geometry: THREE.BufferGeometry): THREE.Vector3[] {
  const p = geometry.getAttribute('position');
  const at = (i: number) => new THREE.Vector3().fromBufferAttribute(p, i);
  const normals: THREE.Vector3[] = [];
  for (let i = 0; i < p.count; i += 3) {
    const [a, b, c] = [at(i), at(i + 1), at(i + 2)];
    normals.push(new THREE.Vector3().crossVectors(b.sub(a), c.sub(a)).normalize());
  }
  return normals;
}

/** Whether every triangle fronts away from `centre`, as a closed box seen from outside does. */
function frontsOutward(geometry: THREE.BufferGeometry, centre: THREE.Vector3, triangles = Infinity): boolean {
  const p = geometry.getAttribute('position');
  return frontNormals(geometry)
    .slice(0, triangles)
    .every((normal, t) => {
      const corner = new THREE.Vector3().fromBufferAttribute(p, t * 3).sub(centre);
      return normal.dot(corner) > 0;
    });
}

describe('csgMesh3DGeometry: mesh sources', () => {
  it('builds a .tres ArrayMesh with one draw group per surface material', () => {
    const solid = build('ExtResource("1")')!;
    expect(solid.materials).toHaveLength(2);
    expect(solid.materials.every((m) => m?.startsWith(`${TWO_BOXES_PATH}::StandardMaterial3D_`))).toBe(true);
    expect(solid.geometry.groups.map((g) => [g.count, g.materialIndex])).toEqual([
      [36, 0],
      [36, 1],
    ]);
  });

  it('fronts a .tres ArrayMesh outward, so Godot’s clockwise faces survive the winding swap', () => {
    // The first surface is a box centred on x = -0.35.
    const solid = build('ExtResource("1")')!;
    expect(frontsOutward(solid.geometry, new THREE.Vector3(-0.35, 0, 0), 12)).toBe(true);
  });

  it('builds a .tres PrimitiveMesh under its own material, as a path into its file', () => {
    const solid = build('ExtResource("2")')!;
    expect(solid.materials).toEqual([`${BOX_PATH}::StandardMaterial3D_2s5uu`]);
    expect(frontsOutward(solid.geometry, new THREE.Vector3())).toBe(true);
  });

  it('fronts an inline PrimitiveMesh outward, as three built it', () => {
    expect(frontsOutward(build('SubResource("Box")')!.geometry, new THREE.Vector3())).toBe(true);
  });

  it('takes an inline ArrayMesh’s surface materials as references into the scene', () => {
    const solid = build('SubResource("Quads")')!;
    expect(solid.materials).toEqual(['SubResource("Red")']);
    expect(solid.geometry.groups).toHaveLength(0);
  });

  it('builds nothing while the .tres loads', () => {
    expect(build('ExtResource("1")', {}, csgGeometryContext({ externalResources: EXT }))).toBeNull();
  });

  it('builds nothing for a mesh no slice here reads, nor for no mesh', () => {
    expect(build('ExtResource("3")')).toBeNull();
    expect(build('SubResource("Missing")')).toBeNull();
    expect(csgMesh3DGeometry({ flipFaces: false }, CTX)).toBeNull();
  });
});

describe('csgMesh3DGeometry: faces', () => {
  it('replaces every surface’s material with the node’s own', () => {
    const solid = build('ExtResource("1")', { materialPath: 'SubResource("Blue")' })!;
    expect(solid.materials).toEqual(['SubResource("Blue")']);
    expect(solid.geometry.groups).toHaveLength(0);
  });

  it('keeps a face whose normals agree flat, with its plane normal at every corner', () => {
    const { geometry } = build('SubResource("Box")')!;
    const normals = geometry.getAttribute('normal');
    const planes = frontNormals(geometry);
    for (let t = 0; t < planes.length; t++) {
      for (let k = 0; k < 3; k++) {
        expect(
          new THREE.Vector3().fromBufferAttribute(normals, t * 3 + k).distanceTo(planes[t]!)
        ).toBeLessThan(1e-5);
      }
    }
  });

  it('smooths a face whose normals differ, so a capsule’s corner normals leave its planes', () => {
    const { geometry } = build('SubResource("Capsule")')!;
    const normals = geometry.getAttribute('normal');
    const planes = frontNormals(geometry);
    const smoothed = planes.some(
      (plane, t) => new THREE.Vector3().fromBufferAttribute(normals, t * 3).distanceTo(plane) > 1e-3
    );
    expect(smoothed).toBe(true);
  });

  it('turns every face inward under flip_faces', () => {
    const { geometry } = build('SubResource("Box")', { flipFaces: true })!;
    const inward = frontNormals(geometry).map((n) => n.negate());
    const p = geometry.getAttribute('position');
    expect(inward.every((n, t) => n.dot(new THREE.Vector3().fromBufferAttribute(p, t * 3)) > 0)).toBe(true);
  });
});

describe('csgMesh3DGeometryKey', () => {
  const key = (mesh: string, ctx = CTX, flipFaces = false) => csgMesh3DGeometryKey({ mesh, flipFaces }, ctx);

  it('changes when the .tres arrives, and again when it reloads', () => {
    const pending = key('ExtResource("1")', csgGeometryContext({ externalResources: EXT }));
    const loaded = key('ExtResource("1")');
    const reloaded = key(
      'ExtResource("1")',
      csgGeometryContext({
        externalResources: EXT,
        files: { [TWO_BOXES_PATH]: fixture('unit-csg-mesh-sources-two-boxes.tres') },
      })
    );
    expect(new Set([pending, loaded, reloaded]).size).toBe(3);
  });

  it('stays the same for the same loaded file', () => {
    expect(key('ExtResource("1")')).toBe(key('ExtResource("1")'));
  });

  it('changes with flip_faces', () => {
    expect(key('SubResource("Box")')).not.toBe(key('SubResource("Box")', CTX, true));
  });
});

describe('csgMesh3DReadsFiles', () => {
  const pools = { internalResources: [], externalResources: EXT };

  it('names the .tres an external mesh loads', () => {
    expect(csgMesh3DReadsFiles({ mesh: 'ExtResource("1")' }, pools)).toEqual([TWO_BOXES_PATH]);
  });

  it('names no file for an inline mesh, or for a file no processor reads', () => {
    expect(csgMesh3DReadsFiles({ mesh: 'SubResource("Box")' }, pools)).toEqual([]);
    expect(csgMesh3DReadsFiles({ mesh: 'ExtResource("3")' }, pools)).toEqual([]);
  });

  it('names no file for a node with no mesh', () => {
    expect(csgMesh3DReadsFiles({}, pools)).toEqual([]);
  });
});
