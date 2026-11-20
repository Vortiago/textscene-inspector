import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { countDrawnSurfaces, ENGINE_DRAW_FLAG, type DrawnSurfaces } from './drawnSurfaces';

/** A render list whose opaque part holds `objects` of one scene, each drawn whole, as three pushes them. */
function listOf(...objects: THREE.Object3D[]): THREE.WebGLRenderList {
  new THREE.Scene().add(...objects);
  const opaque = objects.map((object) => ({
    object,
    geometry: (object as THREE.Mesh).geometry,
    group: null,
  }));
  return { opaque, transmissive: [], transparent: [] } as unknown as THREE.WebGLRenderList;
}

function counted(list: THREE.WebGLRenderList): DrawnSurfaces {
  const counts = { objects: 0, primitives: 0 };
  countDrawnSurfaces(list, counts);
  return counts;
}

/** A box in a scene, as three finds each surface it lists. */
const box = () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry());
  new THREE.Scene().add(mesh);
  return mesh;
};

function points(count: number): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(count * 3), 3)
  );
}

describe('countDrawnSurfaces', () => {
  it("counts a box as one object of 12 triangles, as Godot's monitor counts a BoxMesh", () => {
    expect(counted(listOf(box()))).toEqual({ objects: 1, primitives: 12 });
  });

  it('counts each drawn group of a geometry as its own surface', () => {
    const mesh = box();
    const opaque = mesh.geometry.groups.map((group) => ({ object: mesh, geometry: mesh.geometry, group }));
    const list = { opaque, transmissive: [], transparent: [] } as unknown as THREE.WebGLRenderList;
    expect(counted(list)).toEqual({ objects: 6, primitives: 12 });
  });

  it('counts the transmissive and transparent surfaces too', () => {
    const mesh = box();
    const item = { object: mesh, geometry: mesh.geometry, group: null };
    const list = {
      opaque: [],
      transmissive: [item],
      transparent: [item],
    } as unknown as THREE.WebGLRenderList;
    expect(counted(list)).toEqual({ objects: 2, primitives: 24 });
  });

  it('multiplies the primitives of an instanced mesh by its instances', () => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), undefined, 3);
    expect(counted(listOf(mesh))).toEqual({ objects: 1, primitives: 36 });
  });

  it('counts at most the instances three draws of an instanced geometry (edge case)', () => {
    const geometry = Object.assign(new THREE.InstancedBufferGeometry().copy(new THREE.BoxGeometry()), {
      instanceCount: 10,
      _maxInstanceCount: 2,
    });
    expect(counted(listOf(new THREE.Mesh(geometry))).primitives).toBe(24);
  });

  it.each<[string, THREE.Object3D, number]>([
    ['line segments', new THREE.LineSegments(points(4)), 2],
    ['a line strip', new THREE.Line(points(4)), 3],
    ['points', new THREE.Points(points(5)), 5],
  ])('counts the primitives of %s as Godot counts its primitive', (_, object, primitives) => {
    expect(counted(listOf(object)).primitives).toBe(primitives);
  });

  it('counts only the draw range of a geometry', () => {
    const mesh = box();
    mesh.geometry.setDrawRange(0, 6);
    expect(counted(listOf(mesh)).primitives).toBe(2);
  });

  it('counts no surface that draws no vertex, such as a sentinel (edge case)', () => {
    expect(counted(listOf(new THREE.Mesh(new THREE.BufferGeometry())))).toEqual({
      objects: 0,
      primitives: 0,
    });
  });

  it('counts no background mesh, which three lists with no parent (edge case)', () => {
    const background = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    const list = {
      opaque: [{ object: background, geometry: background.geometry, group: null }],
      transmissive: [],
      transparent: [],
    };
    expect(counted(list as unknown as THREE.WebGLRenderList)).toEqual({ objects: 0, primitives: 0 });
  });

  it('counts no surface the engine draws, such as the sky (edge case)', () => {
    const sky = box();
    sky.userData[ENGINE_DRAW_FLAG] = true;
    expect(counted(listOf(sky))).toEqual({ objects: 0, primitives: 0 });
  });
});
