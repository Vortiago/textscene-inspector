/**
 * `correctHelperForParentGroup` without React: a helper mounted as a sibling of its target inside
 * the target's group must not transform twice. `lightHelpers.test.tsx` covers the gizmos.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { correctHelperForParentGroup } from './useTHREEHelper';

/** A HelperLike stub with only the `update()` contract the function needs. */
function makeStubHelper(): THREE.Object3D & { update: () => void; updateCount: number } {
  const obj = new THREE.Object3D() as THREE.Object3D & { update: () => void; updateCount: number };
  obj.matrixAutoUpdate = false;
  obj.updateCount = 0;
  obj.update = function () { this.updateCount += 1; };
  return obj;
}

/**
 * scene → parent (at `parentPos`, optionally rotated about Y) → target at identity, and the
 * helper as the target's sibling.
 */
function makeSceneGraph(parentPos: THREE.Vector3Like, parentRotationY = 0) {
  const scene = new THREE.Scene();
  const parent = new THREE.Object3D();
  parent.position.set(parentPos.x, parentPos.y, parentPos.z);
  parent.rotation.y = parentRotationY;
  scene.add(parent);

  const target = new THREE.Object3D();
  parent.add(target);

  const helper = makeStubHelper();
  // Alias helper.matrix → target.matrixWorld, same as THREE's affected constructors.
  helper.matrix = target.matrixWorld;
  parent.add(helper);

  scene.updateMatrixWorld(true);
  return { scene, parent, target, helper };
}

describe('correctHelperForParentGroup', () => {
  it('returns the same helper instance (in-place mutation)', () => {
    const { target, helper } = makeSceneGraph({ x: 0, y: 0, z: 0 });
    const returned = correctHelperForParentGroup(helper, target);
    expect(returned).toBe(helper);
  });

  it('breaks the constructor alias: helper.matrix is no longer target.matrixWorld', () => {
    const { target, helper } = makeSceneGraph({ x: 0, y: 0, z: 0 });
    // The constructor aliases helper.matrix = target.matrixWorld.
    expect(helper.matrix).toBe(target.matrixWorld);
    correctHelperForParentGroup(helper, target);
    expect(helper.matrix).not.toBe(target.matrixWorld);
  });

  it('calls through to the original update() implementation', () => {
    // The wrapped `update()` still calls the original once per call.
    const { target, helper } = makeSceneGraph({ x: 0, y: 5, z: 0 });
    expect(helper.updateCount).toBe(0);
    correctHelperForParentGroup(helper, target);
    // The helper is parented, so the correction branch also runs; the point
    // here is only that nativeUpdate fires exactly once per wrapped call.
    helper.update();
    expect(helper.updateCount).toBe(1);
  });

  it('leaves helper.matrixWorld equal to target.matrixWorld after update() when helper has a parent', () => {
    const parentPos = { x: 10, y: 5, z: -3 };
    const { scene, target, helper } = makeSceneGraph(parentPos);
    correctHelperForParentGroup(helper, target);
    scene.updateMatrixWorld(true);
    helper.update();

    const helperPos = new THREE.Vector3().setFromMatrixPosition(helper.matrixWorld);
    const targetPos = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld);
    expect(helperPos.x).toBeCloseTo(targetPos.x, 5);
    expect(helperPos.y).toBeCloseTo(targetPos.y, 5);
    expect(helperPos.z).toBeCloseTo(targetPos.z, 5);
  });

  it('does NOT double-apply the parent transform (the core regression)', () => {
    // An aliased helper.matrix is already a world matrix, so the parent chain applies the parent
    // twice: parent.matrixWorld * target.matrixWorld puts the helper at Y=10, not Y=5.
    const parentPos = { x: 0, y: 5, z: 0 };
    const { scene, target, helper } = makeSceneGraph(parentPos);
    correctHelperForParentGroup(helper, target);
    scene.updateMatrixWorld(true);
    helper.update();

    const helperY = new THREE.Vector3().setFromMatrixPosition(helper.matrixWorld).y;
    // Correct: Y == 5 (the parent's translation). Double-transform would be Y == 10.
    expect(helperY).toBeCloseTo(5, 5);
  });

  it('skips the correction when helper has no parent yet (pre-mount state)', () => {
    // Inside the usePrimitiveHelper factory the helper has no parent yet.
    const target = new THREE.Object3D();
    const helper = makeStubHelper();
    const corrected = correctHelperForParentGroup(helper, target);
    // With no parent, update() must not throw.
    expect(() => corrected.update()).not.toThrow();
  });

  it('does not corrupt the target matrixWorld when update() fires', () => {
    // Re-enabling matrixAutoUpdate without breaking the alias lets compose() write identity into
    // target.matrixWorld.
    const parentPos = { x: 0, y: 5, z: 0 };
    const { scene, target, helper } = makeSceneGraph(parentPos);
    correctHelperForParentGroup(helper, target);
    scene.updateMatrixWorld(true);
    helper.update();

    const targetY = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld).y;
    expect(targetY).toBeCloseTo(5, 5);
  });

  it('works when the parent group has both translation and rotation', () => {
    const { target, helper } = makeSceneGraph({ x: 3, y: 4, z: 0 }, Math.PI / 4);
    correctHelperForParentGroup(helper, target);
    helper.update();

    const helperPos = new THREE.Vector3().setFromMatrixPosition(helper.matrixWorld);
    const targetPos = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld);
    expect(helperPos.x).toBeCloseTo(targetPos.x, 5);
    expect(helperPos.y).toBeCloseTo(targetPos.y, 5);
    expect(helperPos.z).toBeCloseTo(targetPos.z, 5);
  });

  it('handles an identity parent (scene root) correctly — no correction needed, no crash', () => {
    const scene = new THREE.Scene();
    const target = new THREE.Object3D();
    scene.add(target);
    const helper = makeStubHelper();
    helper.matrix = target.matrixWorld;
    scene.add(helper);

    scene.updateMatrixWorld(true);
    correctHelperForParentGroup(helper, target);
    helper.update();

    // Scene root has identity matrixWorld. Position must still be 0,0,0.
    const helperPos = new THREE.Vector3().setFromMatrixPosition(helper.matrixWorld);
    expect(helperPos.x).toBeCloseTo(0, 5);
    expect(helperPos.y).toBeCloseTo(0, 5);
    expect(helperPos.z).toBeCloseTo(0, 5);
  });
});
