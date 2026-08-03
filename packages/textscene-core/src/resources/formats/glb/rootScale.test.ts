import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyRootScale } from './rootScale';
import * as processingShim from '../../processing/rootScale';

/** A GLB-shaped root: a scene root with one transformed child holding a mesh. */
function loadedGlb(): THREE.Object3D {
  const root = new THREE.Object3D();
  root.name = 'Sketchfab_Scene';
  const child = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  child.name = 'tree';
  child.position.set(0, 10, 0);
  child.scale.set(100, 100, 100);
  root.add(child);
  return root;
}

/** World-space size of everything under `root`, which is what the viewer sees. */
function worldHeight(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y;
}

describe('applyRootScale', () => {
  it('shrinks the loaded asset by the sidecar scale', () => {
    const root = loadedGlb();
    const before = worldHeight(root);
    applyRootScale(root, { scale: 0.01, bake: true });
    expect(worldHeight(root)).toBeCloseTo(before * 0.01, 6);
  });

  it('leaves the ROOT at scale 1 when baking, so later children are untouched', () => {
    // Godot's apply_root_scale = true applies the scale to the meshes and leaves the
    // root node alone. The truck town's tree depends on it: the .tscn parents a
    // StaticBody3D/CollisionShape3D to the instanced root, authored against the FINAL
    // size. Scaling the root instead would shrink that collision shape 100x too.
    const root = loadedGlb();
    applyRootScale(root, { scale: 0.01, bake: true });
    expect(root.scale.toArray()).toEqual([1, 1, 1]);

    const laterChild = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    laterChild.name = 'CollisionShape3D';
    root.add(laterChild);
    root.updateMatrixWorld(true);
    expect(laterChild.getWorldScale(new THREE.Vector3()).toArray()).toEqual([1, 1, 1]);
  });

  it('scales the root node instead when apply_root_scale is false', () => {
    const root = loadedGlb();
    applyRootScale(root, { scale: 0.5, bake: false });
    expect(root.scale.toArray()).toEqual([0.5, 0.5, 0.5]);
    // The asset's own children keep their authored transforms in that mode.
    expect(root.children[0]!.scale.toArray()).toEqual([100, 100, 100]);
  });

  it('scales child OFFSETS as well as sizes when baking', () => {
    // A child 10 units up must end up 0.1 units up, not 10 — otherwise the parts of a
    // multi-node asset shrink in place and fly apart.
    const root = loadedGlb();
    applyRootScale(root, { scale: 0.01, bake: true });
    expect(root.children[0]!.position.y).toBeCloseTo(0.1, 9);
  });

  it('preserves child rotation', () => {
    const root = loadedGlb();
    root.children[0]!.rotation.set(0, Math.PI / 4, 0);
    applyRootScale(root, { scale: 0.01, bake: true });
    expect(root.children[0]!.rotation.y).toBeCloseTo(Math.PI / 4, 9);
  });

  it('bakes across every direct child, not just the first', () => {
    const root = new THREE.Object3D();
    for (let i = 0; i < 3; i++) {
      const child = new THREE.Object3D();
      child.position.set(i, i, i);
      root.add(child);
    }
    applyRootScale(root, { scale: 0.5, bake: true });
    expect(root.children.map((c) => c.position.x)).toEqual([0, 0.5, 1]);
  });

  it('is a no-op for a null sidecar result', () => {
    const root = loadedGlb();
    applyRootScale(root, null);
    expect(root.scale.toArray()).toEqual([1, 1, 1]);
    expect(root.children[0]!.scale.toArray()).toEqual([100, 100, 100]);
  });

  it('does not throw on a childless root', () => {
    const root = new THREE.Object3D();
    expect(() => applyRootScale(root, { scale: 0.01, bake: true })).not.toThrow();
  });
});

describe('processing/ re-export shim', () => {
  it('still serves applyRootScale from its old module path', () => {
    expect(processingShim.applyRootScale).toBe(applyRootScale);
  });
});
