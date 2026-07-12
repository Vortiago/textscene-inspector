/**
 * Unit tests for `correctHelperForParentGroup` — the THREE math that
 * prevents `CameraHelper`/`DirectionalLightHelper`/`PointLightHelper` from
 * double-transforming when mounted as a `<primitive>` SIBLING of their target
 * inside the target's own transform group instead of at the scene root.
 *
 * These tests exercise the pure THREE.js function in isolation (no React, no
 * R3F). The integration coverage (actual gizmo components, React lifecycle)
 * lives in `lightHelpers.test.tsx`.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { correctHelperForParentGroup } from './useTHREEHelper';

/** Minimal HelperLike stub — just the `update()` contract the function requires. */
function makeStubHelper(): THREE.Object3D & { update: () => void; updateCount: number } {
  const obj = new THREE.Object3D() as THREE.Object3D & { update: () => void; updateCount: number };
  (obj as { matrixAutoUpdate: boolean }).matrixAutoUpdate = false;
  obj.updateCount = 0;
  obj.update = function () { this.updateCount += 1; };
  return obj;
}

/**
 * Builds a minimal scene graph:
 *   scene
 *   └── parent (translated by `parentPos`)
 *       ├── target (at identity relative to parent, world pos == parentPos)
 *       └── helper (sibling of target, placed by correctHelperForParentGroup)
 */
function makeSceneGraph(parentPos: THREE.Vector3Like) {
  const scene = new THREE.Scene();
  const parent = new THREE.Object3D();
  parent.position.set(parentPos.x, parentPos.y, parentPos.z);
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
    // Before the fix the constructor aliased helper.matrix = target.matrixWorld.
    expect(helper.matrix).toBe(target.matrixWorld);
    correctHelperForParentGroup(helper, target);
    expect(helper.matrix).not.toBe(target.matrixWorld);
  });

  it('calls through to the original update() implementation', () => {
    // correctHelperForParentGroup wraps `update()` — the original must still
    // be invoked once per wrapped call, verified through the counter that the
    // stub increments.
    const { target, helper } = makeSceneGraph({ x: 0, y: 5, z: 0 });
    // Capture the original counter before wrapping.
    expect(helper.updateCount).toBe(0);
    correctHelperForParentGroup(helper, target);
    // No parent: the correction branch is skipped, but nativeUpdate still fires.
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
    // Regression: before the fix, helper.matrix was aliased to target.matrixWorld
    // (already a WORLD matrix), so three.js's parent-chain multiply squared it:
    //   helper.matrixWorld = parent.matrixWorld * helper.matrix
    //                      = parent.matrixWorld * target.matrixWorld   ← world * world
    // For a parent at Y=5 with an identity-local target, the un-fixed helper
    // would land at Y=10 (5 squared), not Y=5.
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
    // During the usePrimitiveHelper factory callback the helper has not been
    // committed to the scene yet, so helper.parent is null. The function must
    // not crash and must leave the helper in a safe state.
    const target = new THREE.Object3D();
    const helper = makeStubHelper();
    const corrected = correctHelperForParentGroup(helper, target);
    // helper has no parent — calling update() must not throw.
    expect(() => corrected.update()).not.toThrow();
  });

  it('does not corrupt the target matrixWorld when update() fires', () => {
    // A naive "fix" that re-enables matrixAutoUpdate without breaking the alias
    // would let three.js's compose() clobber target.matrixWorld to identity.
    const parentPos = { x: 0, y: 5, z: 0 };
    const { scene, target, helper } = makeSceneGraph(parentPos);
    correctHelperForParentGroup(helper, target);
    scene.updateMatrixWorld(true);
    helper.update();

    const targetY = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld).y;
    expect(targetY).toBeCloseTo(5, 5);
  });

  it('works when the parent group has both translation and rotation', () => {
    const scene = new THREE.Scene();
    const parent = new THREE.Object3D();
    parent.position.set(3, 4, 0);
    parent.rotation.y = Math.PI / 4; // 45 degrees around Y
    scene.add(parent);

    const target = new THREE.Object3D();
    parent.add(target);

    const helper = makeStubHelper();
    helper.matrix = target.matrixWorld;
    parent.add(helper);

    scene.updateMatrixWorld(true);
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
