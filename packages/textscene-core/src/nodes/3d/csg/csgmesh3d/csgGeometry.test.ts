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
import {
  COARSE_TUBE,
  curveEndingAt,
  curveFile,
} from '../../../../resources/meshes/primitivemesh/surface.testkit';
import { wallQuadSurfaces } from '../../../../resources/testing/arrayMeshSurfaces';
import { csgMesh3DGeometry, csgMesh3DGeometryKey, csgMesh3DReadsFiles } from './csgGeometry';
import { meshSurfaces, resolveMesh } from './meshSurfaces';

const TWO_BOXES_PATH = 'res://two-boxes.tres';
const BOX_PATH = 'res://box.tres';
const GROWING_CURVE_PATH = 'res://grow.tres';
const FILE_TUBE_PATH = 'res://tube.tres';
const EXT: TscnExternalResource[] = [
  { id: '1', type: 'ArrayMesh', path: TWO_BOXES_PATH },
  { id: '2', type: 'BoxMesh', path: BOX_PATH },
  { id: '3', type: 'PackedScene', path: 'res://rock.glb' },
  { id: '4', type: 'Curve', path: GROWING_CURVE_PATH },
  { id: '5', type: 'TubeTrailMesh', path: FILE_TUBE_PATH },
  { id: '6', type: 'ArrayMesh', path: 'res://rock.obj' },
];

/** A `.tres` Curve that runs from 1 at the top to 3 at the bottom, as {@link curveEndingAt} does. */
const GROWING_CURVE_FILE = parseTresFile(
  `[gd_resource type="Curve" format=3]\n\n[resource]\n_data = ${curveEndingAt('3')._data}\npoint_count = 2\n`
);

/** A `.tres` TubeTrailMesh whose own `curve` names the growing Curve as the file's ExtResource. */
const FILE_TUBE = parseTresFile(
  `[gd_resource type="TubeTrailMesh" format=3]\n\n` +
    `[ext_resource type="Curve" path="${GROWING_CURVE_PATH}" id="1_curve"]\n\n[resource]\n` +
    Object.entries({ ...COARSE_TUBE, curve: 'ExtResource("1_curve")' })
      .map(([name, value]) => `${name} = ${value}\n`)
      .join('')
);

function fixture(name: string): ParsedResource {
  return parseTresFile(readFileSync(join(fixturesDir(), name), 'utf8'));
}

const FILES = {
  [TWO_BOXES_PATH]: fixture('unit-csg-mesh-sources-two-boxes.tres'),
  [BOX_PATH]: fixture('unit-csg-mesh-sources-box.tres'),
  [GROWING_CURVE_PATH]: GROWING_CURVE_FILE,
  [FILE_TUBE_PATH]: FILE_TUBE,
};

const INLINE_BOX: TscnInternalResource = { id: 'Box', type: 'BoxMesh', data: { size: 'Vector3(2, 2, 2)' } };
const INLINE_CAPSULE: TscnInternalResource = { id: 'Capsule', type: 'CapsuleMesh', data: {} };
const INLINE_TUBE: TscnInternalResource = {
  id: 'Tube',
  type: 'TubeTrailMesh',
  data: { ...COARSE_TUBE, curve: 'SubResource("Grow")' },
};
const INLINE_RIBBON: TscnInternalResource = {
  id: 'Ribbon',
  type: 'RibbonTrailMesh',
  data: { sections: '2', section_length: '1', section_segments: '1', curve: 'SubResource("Grow")' },
};
const INLINE_TUBE_WITH_FILE_CURVE: TscnInternalResource = {
  id: 'TubeFile',
  type: 'TubeTrailMesh',
  data: { ...COARSE_TUBE, curve: 'ExtResource("4")' },
};
const growingCurve = (end: string): TscnInternalResource => ({
  id: 'Grow',
  type: 'Curve',
  data: curveEndingAt(end),
});
const INLINE_POINT: TscnInternalResource = { id: 'Point', type: 'PointMesh', data: {} };
const INLINE_QUADS: TscnInternalResource = {
  id: 'Quads',
  type: 'ArrayMesh',
  data: {
    _surfaces: wallQuadSurfaces({ material: 'SubResource("Red")' }, { material: 'SubResource("Red")' }),
  },
};

const INLINE_POINTS: TscnInternalResource = {
  id: 'Points',
  type: 'ArrayMesh',
  data: { _surfaces: wallQuadSurfaces({ primitive: 0 }) },
};

const INLINE_STRIP: TscnInternalResource = {
  id: 'Strip',
  type: 'ArrayMesh',
  data: { _surfaces: wallQuadSurfaces({ primitive: 4 }) },
};

const CTX = csgGeometryContext({
  internalResources: [
    INLINE_BOX,
    INLINE_CAPSULE,
    INLINE_POINT,
    INLINE_POINTS,
    INLINE_STRIP,
    INLINE_QUADS,
    INLINE_TUBE,
    INLINE_RIBBON,
    INLINE_TUBE_WITH_FILE_CURVE,
    growingCurve('3'),
  ],
  externalResources: EXT,
  files: FILES,
});

/** The vertex count of `solid`'s geometry, so a brush with no face reads 0. */
function positionCount(solid: CsgSolid | null): number {
  return solid!.geometry.getAttribute('position').count;
}

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

  it('fronts an inline PrimitiveMesh outward', () => {
    expect(frontsOutward(build('SubResource("Box")')!.geometry, new THREE.Vector3())).toBe(true);
  });

  it("carries an inline BoxMesh's UVs in Godot's 3x2 atlas, a third of the image per face", () => {
    const uv = build('SubResource("Box")')!.geometry.getAttribute('uv');
    const columns = new Set(Array.from({ length: uv.count }, (_, i) => Math.round(uv.getX(i) * 3)));

    expect([...columns].sort()).toEqual([0, 1, 2, 3]);
  });

  it('takes an inline ArrayMesh’s surface materials as references into the scene', () => {
    const solid = build('SubResource("Quads")')!;
    expect(solid.materials).toEqual(['SubResource("Red")']);
    expect(solid.geometry.groups).toHaveLength(0);
  });

  it('builds nothing while the .tres loads', () => {
    expect(build('ExtResource("1")', {}, csgGeometryContext({ externalResources: EXT }))).toBeNull();
  });

  it('builds an inline TubeTrailMesh whose Curve it reads from the scene', () => {
    const { geometry } = build('SubResource("Tube")')!;
    geometry.computeBoundingBox();

    // The Curve grows the bottom row to three times the radius of 0.5.
    expect(geometry.boundingBox!.getSize(new THREE.Vector3()).x).toBeCloseTo(3, 5);
  });

  it('builds an inline RibbonTrailMesh whose Curve it reads from the scene', () => {
    const { geometry } = build('SubResource("Ribbon")')!;
    geometry.computeBoundingBox();

    // The Curve grows the bottom row to three times the size of 1.
    expect(geometry.boundingBox!.getSize(new THREE.Vector3()).x).toBeCloseTo(3, 5);
  });

  it('builds an inline TubeTrailMesh whose Curve is a .tres, once that file has loaded', () => {
    const { geometry } = build('SubResource("TubeFile")')!;
    geometry.computeBoundingBox();

    expect(geometry.boundingBox!.getSize(new THREE.Vector3()).x).toBeCloseTo(3, 5);
  });

  it('builds a .tres TubeTrailMesh whose Curve is a .tres of its own', () => {
    const { geometry } = build('ExtResource("5")')!;
    geometry.computeBoundingBox();

    expect(geometry.boundingBox!.getSize(new THREE.Vector3()).x).toBeCloseTo(3, 5);
  });

  // The brush builder skips every surface that is not PRIMITIVE_TRIANGLES (`csg_shape.cpp:1137-1139`).
  it('builds an empty brush for a PointMesh, whose surface is points', () => {
    expect(positionCount(build('SubResource("Point")'))).toBe(0);
    const { loadedFile, loadedFont } = CTX;
    expect(
      meshSurfaces({ resource: INLINE_POINT, resources: CTX, loadedFile, loadedFont, file: null })
    ).toEqual([]);
  });

  it('builds an empty brush for an ArrayMesh whose surface is points', () => {
    expect(positionCount(build('SubResource("Points")'))).toBe(0);
  });

  it('builds an empty brush for an ArrayMesh whose surface is a triangle strip', () => {
    expect(positionCount(build('SubResource("Strip")'))).toBe(0);
  });

  // A shape with no brush warns in Godot (`csg_shape.cpp:981`), so these differ from a mesh not built.
  it('builds an empty brush for a reference that names no mesh, and for no mesh', () => {
    expect(positionCount(build('ExtResource("3")'))).toBe(0);
    expect(positionCount(build('SubResource("Missing")'))).toBe(0);
    expect(positionCount(csgMesh3DGeometry({ flipFaces: false }, CTX))).toBe(0);
  });

  it('builds no brush for a mesh in a file type no slice reads, which Godot would draw', () => {
    expect(build('ExtResource("6")')).toBeNull();
  });

  it('builds no brush for a mesh type no slice builds, whose faces Godot would draw', () => {
    const ctx = csgGeometryContext({ internalResources: [{ id: 'Text', type: 'TextMesh', data: {} }] });

    expect(build('SubResource("Text")', {}, ctx)).toBeNull();
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

describe('resolveMesh', () => {
  it('gives the same mesh object for the same reference in a context, so a build and its key share it', () => {
    expect(resolveMesh('SubResource("Tube")', CTX)).toBe(resolveMesh('SubResource("Tube")', CTX));
  });

  it('gives a new mesh object in a new context, which holds other resources', () => {
    const other = csgGeometryContext({ internalResources: [INLINE_TUBE], externalResources: EXT });

    expect(resolveMesh('SubResource("Tube")', other)).not.toBe(resolveMesh('SubResource("Tube")', CTX));
  });

  it('gives null for no reference', () => {
    expect(resolveMesh(undefined, CTX)).toBeNull();
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

  it("changes when the body of an inline TubeTrailMesh's Curve changes", () => {
    const withCurve = (end: string) =>
      csgGeometryContext({ internalResources: [INLINE_TUBE, growingCurve(end)] });

    expect(key('SubResource("Tube")', withCurve('2'))).not.toBe(key('SubResource("Tube")', withCurve('3')));
  });

  it('changes when the .tres Curve of a TubeTrailMesh arrives', () => {
    const pending = csgGeometryContext({
      internalResources: [INLINE_TUBE_WITH_FILE_CURVE],
      externalResources: EXT,
    });
    const loaded = csgGeometryContext({
      internalResources: [INLINE_TUBE_WITH_FILE_CURVE],
      externalResources: EXT,
      files: { [GROWING_CURVE_PATH]: GROWING_CURVE_FILE },
    });

    expect(key('SubResource("TubeFile")', loaded)).not.toBe(key('SubResource("TubeFile")', pending));
  });

  it('changes when the Curve file of a .tres TubeTrailMesh changes', () => {
    const withCurveFile = (curve: ParsedResource) =>
      csgGeometryContext({
        externalResources: EXT,
        files: { [FILE_TUBE_PATH]: FILE_TUBE, [GROWING_CURVE_PATH]: curve },
      });

    expect(key('ExtResource("5")', withCurveFile(curveFile('3')))).not.toBe(
      key('ExtResource("5")', withCurveFile(curveFile('2')))
    );
  });

  it('stays the same while an inline TubeTrailMesh and its Curve hold their content', () => {
    const withCurve = () =>
      csgGeometryContext({ internalResources: [{ ...INLINE_TUBE }, growingCurve('2')] });

    expect(key('SubResource("Tube")', withCurve())).toBe(key('SubResource("Tube")', withCurve()));
  });

  it('changes with flip_faces', () => {
    expect(key('SubResource("Box")')).not.toBe(key('SubResource("Box")', CTX, true));
  });
});

describe('csgMesh3DReadsFiles', () => {
  const pools = { internalResources: [INLINE_TUBE_WITH_FILE_CURVE], externalResources: EXT };
  const readsFiles = (properties: Record<string, unknown>, loaded: Record<string, ParsedResource> = {}) =>
    csgMesh3DReadsFiles(properties, pools, (path) => loaded[path]);

  it('names the .tres an external mesh loads', () => {
    expect(readsFiles({ mesh: 'ExtResource("1")' })).toEqual([TWO_BOXES_PATH]);
  });

  it('names no file for an inline mesh that reads none, or for a file no processor reads', () => {
    expect(readsFiles({ mesh: 'SubResource("Box")' })).toEqual([]);
    expect(readsFiles({ mesh: 'ExtResource("3")' })).toEqual([]);
  });

  it('names no file for a node with no mesh', () => {
    expect(readsFiles({})).toEqual([]);
  });

  it('names the .tres Curve an inline TubeTrailMesh reads', () => {
    expect(readsFiles({ mesh: 'SubResource("TubeFile")' })).toEqual([GROWING_CURVE_PATH]);
  });

  it('names the .tres Curve of a .tres TubeTrailMesh only once the mesh file has loaded', () => {
    expect(readsFiles({ mesh: 'ExtResource("5")' })).toEqual([FILE_TUBE_PATH]);
    expect(readsFiles({ mesh: 'ExtResource("5")' }, { [FILE_TUBE_PATH]: FILE_TUBE })).toEqual([
      FILE_TUBE_PATH,
      GROWING_CURVE_PATH,
    ]);
  });
});

describe('csgMesh3DGeometry: a manifold brush', () => {
  /** Whether the brush of a CSGMesh3D over one inline mesh of `type` is closed, as Godot's manifold needs. */
  function isClosed(type: string, data: Record<string, string> = {}): boolean {
    const ctx = csgGeometryContext({ internalResources: [{ id: 'Mesh', type, data }] });
    return build('SubResource("Mesh")', {}, ctx)!.isClosed;
  }

  it.each([
    ['BoxMesh', 'BoxMesh', {}],
    ['CylinderMesh', 'CylinderMesh', {}],
    ['CylinderMesh with one apex', 'CylinderMesh', { top_radius: '0.0' }],
    ['CapsuleMesh', 'CapsuleMesh', {}],
    ['SphereMesh', 'SphereMesh', {}],
    ['TorusMesh', 'TorusMesh', {}],
    ['PrismMesh', 'PrismMesh', {}],
    ['TubeTrailMesh', 'TubeTrailMesh', {}],
  ])('closes the brush of a %s, whose seams weld', (_label, type, data) => {
    expect(isClosed(type, data)).toBe(true);
  });

  it.each([
    ['PlaneMesh', 'PlaneMesh', {}],
    ['QuadMesh', 'QuadMesh', {}],
    ['RibbonTrailMesh', 'RibbonTrailMesh', {}],
    ['CylinderMesh with cap_top off', 'CylinderMesh', { cap_top: 'false' }],
    ['CylinderMesh with cap_bottom off', 'CylinderMesh', { cap_bottom: 'false' }],
  ])('opens the brush of a %s', (_label, type, data) => {
    expect(isClosed(type, data)).toBe(false);
  });

  it('closes a brush that the node flips, since the faces run both ways along each edge still', () => {
    const ctx = csgGeometryContext({ internalResources: [INLINE_BOX] });

    expect(build('SubResource("Box")', { flipFaces: true }, ctx)!.isClosed).toBe(true);
  });
});
