/** `applyBillboard` against Godot's billboard shader basis, on a node built with no renderer. */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BillboardMode } from '../../godot/rendering/materials/billboardMode';
import { applyBillboard } from './nodeBillboard';

/** A camera at `position` whose rotation is `rotation`, with its world matrix current. */
function cameraAt(position: [number, number, number], rotation: [number, number, number]): THREE.Camera {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(...position);
  camera.rotation.set(...rotation);
  camera.updateMatrixWorld();
  return camera;
}

/** `object` under a parent with `parentRotationY`, `parentScale` and a translation. */
function nodeUnderParent(parentRotationY = 0, parentScale = 1): THREE.Object3D {
  const parent = new THREE.Group();
  parent.position.set(1, 2, 3);
  parent.rotation.set(0, parentRotationY, 0);
  parent.scale.setScalar(parentScale);
  const object = new THREE.Object3D();
  object.position.set(0, 0, -4);
  parent.add(object);
  return object;
}

const axis = (object: THREE.Object3D, column: 0 | 1 | 2) =>
  new THREE.Vector3().setFromMatrixColumn(object.matrixWorld, column);

const expectClose = (actual: THREE.Vector3, expected: [number, number, number]) => {
  expect(actual.x).toBeCloseTo(expected[0], 6);
  expect(actual.y).toBeCloseTo(expected[1], 6);
  expect(actual.z).toBeCloseTo(expected[2], 6);
};

describe('applyBillboard', () => {
  it('builds FIXED_Y from the camera axes, not from the direction to the camera', () => {
    // The camera sits off to +X but looks straight down -Z, so Godot's basis
    // (`material.cpp:1291-1295`) faces +Z. A yaw towards the camera would turn 90 degrees.
    const object = nodeUnderParent();

    applyBillboard(object, cameraAt([50, 0, 0], [0, 0, 0]), BillboardMode.BILLBOARD_FIXED_Y);

    expectClose(axis(object, 0), [1, 0, 0]);
    expectClose(axis(object, 1), [0, 1, 0]);
    expectClose(axis(object, 2), [0, 0, 1]);
  });

  it('keeps world up under FIXED_Y while the camera pitches', () => {
    const object = nodeUnderParent();

    applyBillboard(object, cameraAt([0, 5, 5], [-Math.PI / 4, 0, 0]), BillboardMode.BILLBOARD_FIXED_Y);

    expectClose(axis(object, 1), [0, 1, 0]);
    expectClose(axis(object, 2), [0, 0, 1]);
  });

  it("takes the camera's basis under ENABLED whatever the parent's rotation", () => {
    const object = nodeUnderParent(Math.PI / 3);
    const camera = cameraAt([0, 0, 10], [0.2, 0.4, 0]);

    applyBillboard(object, camera, BillboardMode.BILLBOARD_ENABLED);

    const cameraZ = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2);
    expectClose(axis(object, 2), [cameraZ.x, cameraZ.y, cameraZ.z]);
  });

  it('keeps the world scale of the node, as the sprite material sets billboard_keep_scale', () => {
    // `get_material_for_2d` turns on FLAG_BILLBOARD_KEEP_SCALE with either mode (`material.cpp:3056-3058`).
    const object = nodeUnderParent(0, 2);
    object.scale.set(1, 3, 1);

    applyBillboard(object, cameraAt([0, 0, 10], [0, 0, 0]), BillboardMode.BILLBOARD_ENABLED);

    expect(axis(object, 0).length()).toBeCloseTo(2, 6);
    expect(axis(object, 1).length()).toBeCloseTo(6, 6);
  });

  it("keeps the node's world origin", () => {
    const object = nodeUnderParent(Math.PI / 2);

    applyBillboard(object, cameraAt([0, 0, 10], [0, 0, 0]), BillboardMode.BILLBOARD_ENABLED);

    // The parent turns local (0, 0, -4) to (-4, 0, 0) and moves it by (1, 2, 3).
    expectClose(new THREE.Vector3().setFromMatrixPosition(object.matrixWorld), [-3, 2, 3]);
  });

  it('stops three recomputing the world matrix it wrote', () => {
    const object = nodeUnderParent();

    applyBillboard(object, cameraAt([0, 0, 10], [0, 0, 0]), BillboardMode.BILLBOARD_ENABLED);

    expect(object.matrixWorldAutoUpdate).toBe(false);
  });

  it('leaves a DISABLED node to three, with its own rotation', () => {
    const object = nodeUnderParent();
    object.rotation.set(0, 1, 0);
    object.matrixWorldAutoUpdate = false;

    applyBillboard(object, cameraAt([0, 0, 10], [0, 0, 0]), BillboardMode.BILLBOARD_DISABLED);

    expect(object.matrixWorldAutoUpdate).toBe(true);
    expect(object.rotation.y).toBe(1);
  });

  it('billboards a node with no parent from its own matrix (edge case)', () => {
    const object = new THREE.Object3D();
    object.position.set(5, 6, 7);

    applyBillboard(object, cameraAt([0, 0, 10], [0, 0.4, 0]), BillboardMode.BILLBOARD_ENABLED);

    expectClose(new THREE.Vector3().setFromMatrixPosition(object.matrixWorld), [5, 6, 7]);
  });
});
