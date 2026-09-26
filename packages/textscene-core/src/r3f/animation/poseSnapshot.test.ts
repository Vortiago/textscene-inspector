import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { restoreSnapshot, snapshotPose, subtreeObjects } from './poseSnapshot';

function posed(): THREE.Object3D {
  const object = new THREE.Object3D();
  object.position.set(1, 2, 3);
  object.rotation.set(0.1, 0.2, 0.3, 'YXZ');
  object.scale.set(2, 2, 2);
  return object;
}

describe('snapshotPose and restoreSnapshot', () => {
  it('put back the local position, rotation and scale', () => {
    const object = posed();
    const snapshot = snapshotPose([object]);
    object.position.set(9, 9, 9);
    object.rotation.set(1, 1, 1);
    object.scale.set(5, 5, 5);
    restoreSnapshot(snapshot);
    expect([object.position.toArray(), object.scale.toArray()]).toEqual([
      [1, 2, 3],
      [2, 2, 2],
    ]);
    expect(object.quaternion.angleTo(posed().quaternion)).toBeCloseTo(0);
  });

  it('put back the Euler order, which a quaternion alone does not carry', () => {
    const object = posed();
    const snapshot = snapshotPose([object]);
    object.rotation.reorder('XYZ');
    restoreSnapshot(snapshot);
    expect(object.rotation.order).toBe('YXZ');
  });

  it('restore nothing from an empty snapshot', () => {
    expect(() => restoreSnapshot([])).not.toThrow();
  });
});

describe('subtreeObjects', () => {
  it('lists the root and every descendant', () => {
    const root = new THREE.Object3D();
    const child = new THREE.Object3D();
    const grandchild = new THREE.Object3D();
    child.add(grandchild);
    root.add(child);
    expect(subtreeObjects(root)).toEqual([root, child, grandchild]);
  });
});
