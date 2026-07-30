/**
 * Decal projection maths — pure over THREE objects, so the projection is
 * verified here without a canvas or the R3F component (which the test-renderer
 * cannot exercise: it populates no `matrixWorld` and mounts no sibling meshes).
 *
 * Coverage: the box AABB in world space; the receiver filter (real meshes in,
 * decal projections / non-meshes out, non-overlapping out, `cull_mask`-culled
 * render layers out); and the projection itself — a horizontal floor inside the
 * box bakes to geometry that lies on the floor, stays within the footprint, and
 * carries in-range UVs; a floor outside the box clips to nothing.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { visualLayersUserData } from '../../../r3f/visualLayers';
import {
  buildDecalProjectionGeometry,
  collectDecalReceivers,
  computeDecalBoxWorldAABB,
} from './decalProjection';

/** A horizontal quad (normal +Y) of half-extent `s`, lying in the world XZ plane. */
function horizontalFloor(s = 4): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  // Two triangles, non-indexed.
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [-s, 0, -s, s, 0, -s, s, 0, s, -s, 0, -s, s, 0, s, -s, 0, s],
      3
    )
  );
  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3)
  );
  return new THREE.Mesh(geometry);
}

/** Decal world matrix = translation only (identity basis). */
function decalAt(x: number, y: number, z: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(x, y, z);
}

const SIZE = { x: 3, y: 3, z: 3 };

describe('computeDecalBoxWorldAABB', () => {
  it('bounds the ±size/2 box around the decal origin', () => {
    const box = computeDecalBoxWorldAABB(decalAt(0, 1, 0), SIZE);
    expect(box.min.x).toBeCloseTo(-1.5, 5);
    expect(box.min.y).toBeCloseTo(-0.5, 5);
    expect(box.min.z).toBeCloseTo(-1.5, 5);
    expect(box.max.x).toBeCloseTo(1.5, 5);
    expect(box.max.y).toBeCloseTo(2.5, 5);
    expect(box.max.z).toBeCloseTo(1.5, 5);
  });
});

describe('collectDecalReceivers', () => {
  it('returns real meshes overlapping the box and skips projections / non-meshes', () => {
    const root = new THREE.Group();
    const floor = horizontalFloor();
    floor.name = 'floor';

    const otherDecal = horizontalFloor();
    otherDecal.userData.isDecalProjection = true; // another decal's output

    const gizmo = new THREE.LineSegments(new THREE.BufferGeometry());

    root.add(floor, otherDecal, gizmo);
    root.updateMatrixWorld(true);

    const box = computeDecalBoxWorldAABB(decalAt(0, 1, 0), SIZE);
    const receivers = collectDecalReceivers(root, box);
    expect(receivers.map((m) => m.name)).toEqual(['floor']);
  });

  it('skips meshes whose world bounds do not overlap the box', () => {
    const root = new THREE.Group();
    const near = horizontalFloor(1);
    near.name = 'near';
    const far = horizontalFloor(1);
    far.name = 'far';
    far.position.set(100, 0, 0);
    root.add(near, far);
    root.updateMatrixWorld(true);

    const box = computeDecalBoxWorldAABB(decalAt(0, 1, 0), SIZE);
    expect(collectDecalReceivers(root, box).map((m) => m.name)).toEqual(['near']);
  });

  it('excludes receivers whose Godot render layers the cull_mask culls', () => {
    const root = new THREE.Group();
    const ground = horizontalFloor();
    ground.name = 'ground'; // untagged → layer 1
    const vehicle = horizontalFloor();
    vehicle.name = 'vehicle';
    Object.assign(vehicle.userData, visualLayersUserData(2)); // layers = 2
    root.add(ground, vehicle);
    root.updateMatrixWorld(true);

    const box = computeDecalBoxWorldAABB(decalAt(0, 1, 0), SIZE);
    // Truck Town's blob shadows: every layer but layer 2.
    expect(collectDecalReceivers(root, box, 0xffffd).map((m) => m.name)).toEqual(['ground']);
  });

  it('keeps a layer-2 receiver under the default mask', () => {
    const root = new THREE.Group();
    const vehicle = horizontalFloor();
    vehicle.name = 'vehicle';
    Object.assign(vehicle.userData, visualLayersUserData(2));
    root.add(vehicle);
    root.updateMatrixWorld(true);

    const box = computeDecalBoxWorldAABB(decalAt(0, 1, 0), SIZE);
    expect(collectDecalReceivers(root, box, 0xfffff).map((m) => m.name)).toEqual(['vehicle']);
    // An omitted mask behaves as Godot's default, so a decal that never
    // authored `cull_mask` keeps every receiver it used to have.
    expect(collectDecalReceivers(root, box).map((m) => m.name)).toEqual(['vehicle']);
  });

  it('keeps a receiver sharing ANY layer with the mask', () => {
    const root = new THREE.Group();
    const both = horizontalFloor();
    both.name = 'both';
    Object.assign(both.userData, visualLayersUserData(3)); // layers 1 AND 2
    root.add(both);
    root.updateMatrixWorld(true);

    const box = computeDecalBoxWorldAABB(decalAt(0, 1, 0), SIZE);
    expect(collectDecalReceivers(root, box, 0xffffd).map((m) => m.name)).toEqual(['both']);
  });

  it('collects nothing when the cull_mask is zero', () => {
    const root = new THREE.Group();
    const floor = horizontalFloor();
    floor.name = 'floor';
    root.add(floor);
    root.updateMatrixWorld(true);

    const box = computeDecalBoxWorldAABB(decalAt(0, 1, 0), SIZE);
    expect(collectDecalReceivers(root, box, 0)).toEqual([]);
  });
});

describe('buildDecalProjectionGeometry', () => {
  it('projects a floor inside the box onto the surface, within the footprint and UV range', () => {
    const floor = horizontalFloor();
    floor.updateMatrixWorld(true);
    const decalWorld = decalAt(0, 1, 0);
    const geometry = buildDecalProjectionGeometry(floor, decalWorld.clone().invert(), SIZE);

    expect(geometry).not.toBeNull();
    const pos = geometry!.getAttribute('position');
    expect(pos.count).toBeGreaterThan(0);

    for (let i = 0; i < pos.count; i++) {
      // Footprint is clipped to ±size/2 in the decal's local X and Z.
      expect(Math.abs(pos.getX(i))).toBeLessThanOrEqual(1.5 + 1e-4);
      expect(Math.abs(pos.getZ(i))).toBeLessThanOrEqual(1.5 + 1e-4);
      // The floor is 1 unit below the decal origin → decal-local y ≈ -1.
      expect(pos.getY(i)).toBeCloseTo(-1, 4);
    }

    const uv = geometry!.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(-1e-4);
      expect(uv.getX(i)).toBeLessThanOrEqual(1 + 1e-4);
      expect(uv.getY(i)).toBeGreaterThanOrEqual(-1e-4);
      expect(uv.getY(i)).toBeLessThanOrEqual(1 + 1e-4);
    }
  });

  it('returns null when the receiver lies outside the projection box', () => {
    const floor = horizontalFloor(1);
    floor.position.set(100, 0, 0);
    floor.updateMatrixWorld(true);
    const decalWorld = decalAt(0, 1, 0);
    expect(buildDecalProjectionGeometry(floor, decalWorld.clone().invert(), SIZE)).toBeNull();
  });
});
