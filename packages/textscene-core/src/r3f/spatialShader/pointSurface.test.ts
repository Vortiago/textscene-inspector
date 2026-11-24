import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { withGodotAttributes } from '../../shaders/spatial/meshAttributes';
import { OTHER_DRAWS_SURFACE } from '../materials/useOneSurfaceStartingMaterial';
import { drawPoints, isEmulatedPoints, refreshEmulatedPoints } from './pointSurface';

/** Two triangles of a quad, the first in draw group 0 and the second in draw group 1. */
function twoGroupQuad(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3)
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.addGroup(0, 3, 0);
  geometry.addGroup(3, 3, 1);
  return withGodotAttributes(geometry);
}

const material = new THREE.MeshBasicMaterial();

describe('drawPoints', () => {
  it('leaves a points host to draw its own points, at the native size', () => {
    const host = new THREE.Points(twoGroupQuad());
    expect(drawPoints(host, null, material, 'native')).toBeNull();
    expect(host.children).toEqual([]);
  });

  it('draws a mesh group as points of its own geometry, with the other groups undrawn', () => {
    const host = new THREE.Mesh(twoGroupQuad());
    drawPoints(host, 1, material, 'native');
    const [points] = host.children as THREE.Points[];
    expect(points!.isPoints).toBe(true);
    expect(points!.geometry).toBe(host.geometry);
    expect(points!.material).toEqual([OTHER_DRAWS_SURFACE, material]);
  });

  it("draws an emulated point for each corner of the group in Godot's order, as Vulkan draws indexed points", () => {
    const host = new THREE.Mesh(twoGroupQuad());
    drawPoints(host, 1, material, 'emulated');
    const [points] = host.children as THREE.Mesh<THREE.InstancedBufferGeometry>[];
    expect(isEmulatedPoints(points!)).toBe(true);
    expect([...points!.geometry.getAttribute('point_vertex_attrib').array]).toEqual([0, 3, 2]);
  });

  it("takes the host's shadows, layers and draw order, and is never picked", () => {
    const host = new THREE.Mesh(twoGroupQuad());
    host.castShadow = true;
    host.renderOrder = 3;
    host.layers.set(4);
    drawPoints(host, null, material, 'emulated');
    const [points] = host.children;
    expect([points!.castShadow, points!.renderOrder, points!.layers.mask]).toEqual([true, 3, 1 << 4]);
    const hits: THREE.Intersection[] = [];
    points!.raycast(new THREE.Raycaster(), hits);
    expect(hits).toEqual([]);
  });

  it('takes the points away on the returned call', () => {
    const host = new THREE.Mesh(twoGroupQuad());
    drawPoints(host, null, material, 'emulated')!();
    expect(host.children).toEqual([]);
  });
});

describe('refreshEmulatedPoints', () => {
  it('rebuilds the quads from the surface as it is now', () => {
    const host = new THREE.Mesh(twoGroupQuad());
    drawPoints(host, null, material, 'emulated');
    const [points] = host.children as THREE.Mesh[];
    const before = points!.geometry;
    refreshEmulatedPoints(points!, host.geometry);
    expect(points!.geometry).not.toBe(before);
  });
});
