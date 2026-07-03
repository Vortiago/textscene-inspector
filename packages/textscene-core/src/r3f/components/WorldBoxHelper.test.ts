/**
 * Regression coverage for the GLB/skinned-mesh selection box landing on the
 * world origin instead of the rendered model (the platformer Player symptom).
 *
 * Root cause: `THREE.Box3.setFromObject` prefers `SkinnedMesh.boundingBox`
 * (the posed/cached box) over `geometry.boundingBox`. For GLTF-cloned skinned
 * meshes that posed box is in a corrupted frame, so the selection box collapses
 * to the origin. `computeWorldBoundingBox` uses `geometry.boundingBox ×
 * matrixWorld` and must therefore track the rendered position.
 */
import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { computeWorldBoundingBox } from '../bounds.js';

function unitBoxGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(2, 2, 2); // local AABB: (-1,-1,-1)..(1,1,1)
  geo.computeBoundingBox();
  return geo;
}

describe('computeWorldBoundingBox', () => {
  it('bounds a plain mesh at its world position', () => {
    const mesh = new THREE.Mesh(unitBoxGeometry(), new THREE.MeshBasicMaterial());
    const parent = new THREE.Group();
    parent.position.set(10, -3, 4);
    parent.add(mesh);

    const center = computeWorldBoundingBox(parent).getCenter(new THREE.Vector3());
    expect(center.x).toBeCloseTo(10, 5);
    expect(center.y).toBeCloseTo(-3, 5);
    expect(center.z).toBeCloseTo(4, 5);
  });

  it('uses the geometry (bind) box for a SkinnedMesh, ignoring a corrupt cached SkinnedMesh.boundingBox', () => {
    const skinned = new THREE.SkinnedMesh(unitBoxGeometry(), new THREE.MeshBasicMaterial());
    // Mimic the GLTF-clone bug: a posed/cached box in a far-away frame.
    skinned.boundingBox = new THREE.Box3(
      new THREE.Vector3(100, 100, 100),
      new THREE.Vector3(102, 102, 102)
    );

    const parent = new THREE.Group();
    parent.position.set(-9.5, -3.84, 3.93); // the platformer Player's instance origin
    parent.add(skinned);
    parent.updateWorldMatrix(true, true);

    // Our function tracks the rendered position via geometry.boundingBox.
    const ours = computeWorldBoundingBox(parent).getCenter(new THREE.Vector3());
    expect(ours.x).toBeCloseTo(-9.5, 5);
    expect(ours.y).toBeCloseTo(-3.84, 5);
    expect(ours.z).toBeCloseTo(3.93, 5);

    // Document the three.js behavior we work around: setFromObject uses the
    // corrupt SkinnedMesh.boundingBox and lands far from the model.
    const broken = new THREE.Box3().setFromObject(parent).getCenter(new THREE.Vector3());
    expect(broken.distanceTo(ours)).toBeGreaterThan(50);
  });

  it('unions multiple meshes across the subtree', () => {
    const parent = new THREE.Group();
    const a = new THREE.Mesh(unitBoxGeometry(), new THREE.MeshBasicMaterial());
    a.position.set(-5, 0, 0);
    const b = new THREE.Mesh(unitBoxGeometry(), new THREE.MeshBasicMaterial());
    b.position.set(5, 0, 0);
    parent.add(a, b);

    const box = computeWorldBoundingBox(parent);
    expect(box.min.x).toBeCloseTo(-6, 5); // -5 - 1
    expect(box.max.x).toBeCloseTo(6, 5); //  5 + 1
  });

  it('returns an empty box when no descendant has geometry', () => {
    const parent = new THREE.Group();
    parent.add(new THREE.Object3D(), new THREE.Group());
    expect(computeWorldBoundingBox(parent).isEmpty()).toBe(true);
  });
});
