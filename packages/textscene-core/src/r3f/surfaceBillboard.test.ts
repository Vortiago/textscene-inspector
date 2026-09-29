import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { billboardWorldMatrix } from './surfaceBillboard';
import { BillboardMode } from '../godot/billboard';
import { TEST_CAMERA } from './testing/threePasses';

/** A model yawed a quarter turn, scaled (2, 3, 4), at (5, 6, 7). */
function yawedScaledModel(): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(5, 6, 7),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2),
    new THREE.Vector3(2, 3, 4)
  );
}

function column(matrix: THREE.Matrix4, index: 0 | 1 | 2 | 3): THREE.Vector3 {
  return new THREE.Vector3().setFromMatrixColumn(matrix, index);
}

function expectVectorClose(actual: THREE.Vector3, expected: THREE.Vector3) {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
  expect(actual.z).toBeCloseTo(expected.z, 6);
}

describe('billboardWorldMatrix — ENABLED', () => {
  const camera = TEST_CAMERA;

  it('takes the camera basis as the model basis', () => {
    const target = new THREE.Matrix4();
    expect(billboardWorldMatrix(target, yawedScaledModel(), camera.matrixWorld, { mode: BillboardMode.BILLBOARD_ENABLED, keepScale: true })).toBe(true);
    for (const i of [0, 1, 2] as const) {
      expectVectorClose(column(target, i).normalize(), column(camera.matrixWorld, i).normalize());
    }
  });

  it('keeps the model origin', () => {
    const target = new THREE.Matrix4();
    billboardWorldMatrix(target, yawedScaledModel(), camera.matrixWorld, { mode: BillboardMode.BILLBOARD_ENABLED, keepScale: true });
    expectVectorClose(column(target, 3), new THREE.Vector3(5, 6, 7));
  });

  it('drops the model scale by default, as Godot does without billboard_keep_scale', () => {
    // `material.cpp:1266-1271` takes the camera basis alone; `:1274-1281` multiplies the
    // model scale back only under FLAG_BILLBOARD_KEEP_SCALE.
    const target = new THREE.Matrix4();
    billboardWorldMatrix(target, yawedScaledModel(), camera.matrixWorld, {
      mode: BillboardMode.BILLBOARD_ENABLED,
      keepScale: false,
    });
    for (const i of [0, 1, 2] as const) expect(column(target, i).length()).toBeCloseTo(1, 6);
  });

  it('keeps the model scale per axis, as billboard_keep_scale does', () => {
    const target = new THREE.Matrix4();
    billboardWorldMatrix(target, yawedScaledModel(), camera.matrixWorld, { mode: BillboardMode.BILLBOARD_ENABLED, keepScale: true });
    expect(column(target, 0).length()).toBeCloseTo(2, 6);
    expect(column(target, 1).length()).toBeCloseTo(3, 6);
    expect(column(target, 2).length()).toBeCloseTo(4, 6);
  });
});

describe('billboardWorldMatrix — FIXED_Y', () => {
  it('keeps world up as the Y axis and turns X and Z toward the camera plane', () => {
    const camera = TEST_CAMERA;
    const target = new THREE.Matrix4();
    expect(billboardWorldMatrix(target, yawedScaledModel(), camera.matrixWorld, { mode: BillboardMode.BILLBOARD_FIXED_Y, keepScale: true })).toBe(true);

    const up = new THREE.Vector3(0, 1, 0);
    const cameraX = column(camera.matrixWorld, 0);
    const cameraZ = column(camera.matrixWorld, 2);
    expectVectorClose(column(target, 0), up.clone().cross(cameraZ).normalize().multiplyScalar(2));
    expectVectorClose(column(target, 1), new THREE.Vector3(0, 3, 0));
    expectVectorClose(column(target, 2), cameraX.clone().cross(up).normalize().multiplyScalar(4));
    expectVectorClose(column(target, 3), new THREE.Vector3(5, 6, 7));
  });

  it('leaves the target alone when the camera looks straight down the Y axis', () => {
    // `normalize(cross(up, camZ))` of an exactly zero vector has no direction.
    const lookingDown = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 1, 0)
    );
    const target = new THREE.Matrix4().makeScale(9, 9, 9);
    expect(billboardWorldMatrix(target, yawedScaledModel(), lookingDown, { mode: BillboardMode.BILLBOARD_FIXED_Y, keepScale: true })).toBe(false);
    expect(target.equals(new THREE.Matrix4().makeScale(9, 9, 9))).toBe(true);
  });
});

describe('billboardWorldMatrix — PARTICLES', () => {
  it('normalises the camera basis, unlike ENABLED', () => {
    // A camera under a scaled parent: ENABLED copies its columns, PARTICLES normalises them.
    const cameraWorld = new THREE.Matrix4().makeScale(2, 2, 2);
    const particles = new THREE.Matrix4();
    const enabled = new THREE.Matrix4();
    billboardWorldMatrix(particles, new THREE.Matrix4(), cameraWorld, { mode: BillboardMode.BILLBOARD_PARTICLES, keepScale: true });
    billboardWorldMatrix(enabled, new THREE.Matrix4(), cameraWorld, { mode: BillboardMode.BILLBOARD_ENABLED, keepScale: true });
    expect(column(particles, 0).length()).toBeCloseTo(1, 6);
    expect(column(enabled, 0).length()).toBeCloseTo(2, 6);
  });
});

describe('billboardWorldMatrix — DISABLED', () => {
  it('reports no billboard and leaves the target alone', () => {
    const camera = TEST_CAMERA;
    const target = new THREE.Matrix4().makeScale(9, 9, 9);
    expect(billboardWorldMatrix(target, yawedScaledModel(), camera.matrixWorld, { mode: BillboardMode.BILLBOARD_DISABLED, keepScale: true })).toBe(false);
    expect(target.equals(new THREE.Matrix4().makeScale(9, 9, 9))).toBe(true);
  });

  it('treats a mode outside the enum as DISABLED', () => {
    const camera = TEST_CAMERA;
    expect(billboardWorldMatrix(new THREE.Matrix4(), yawedScaledModel(), camera.matrixWorld, { mode: 7, keepScale: true })).toBe(false);
  });
});
