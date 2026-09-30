/**
 * The atlas is checked through the matrices three samples with: a split is right when its matrix
 * maps its own slice into its own rectangle of the atlas, in texture coordinates.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { DirectionalSplitShadow, SPLIT_CAMERA_UP, SPLIT_SLOTS } from './splitShadow';
import { directionalShadowUserData } from './declaration';
import { fitSceneDirectionalShadows } from './fitSceneDirectionalShadows';
import { cameraSliceCorners } from './fitDirectionalShadowBox';
import { splitSunOf } from './splitSun';
import { directionalShadowSplitAtlasRect } from '../../godot/directionalShadow';

const ATLAS_SIZE = 4096;
const FACE_TOLERANCE = 1e-9;

function viewingCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 4000);
  camera.position.set(0, 10, 40);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

/** A split light fitted to `camera`, its shadow matrices updated as the shadow pass does. */
function fittedShadow(camera: THREE.PerspectiveCamera, splitCount: number): DirectionalSplitShadow {
  const scene = new THREE.Scene();
  const light = new THREE.DirectionalLight();
  light.position.set(10, 20, 5);
  light.castShadow = true;
  light.userData = directionalShadowUserData({
    maxDistance: 80,
    pancakeSize: 20,
    fadeStart: 0.8,
    depthBias: 0,
    normalBias: 2,
    splitCount,
    splitOffsets: [0.1, 0.2, 0.5],
    blendSplits: false,
  });
  scene.add(light, light.target);
  scene.updateMatrixWorld();
  fitSceneDirectionalShadows(scene, camera);
  const sun = splitSunOf(light)!;
  sun.shadow.updateMatrices(sun);
  return sun.shadow;
}

/** Whether `point` lands inside `rect` of the atlas, in texture coordinates, and inside its depth. */
function landsIn(matrix: THREE.Matrix4, point: THREE.Vector3, rect: { x: number; y: number; width: number; height: number }): boolean {
  const mapped = point.clone().applyMatrix4(matrix);
  const within = (value: number, start: number, size: number) =>
    value >= start / ATLAS_SIZE - FACE_TOLERANCE && value <= (start + size) / ATLAS_SIZE + FACE_TOLERANCE;
  return (
    within(mapped.x, rect.x, rect.width) &&
    within(mapped.y, rect.y, rect.height) &&
    mapped.z >= -FACE_TOLERANCE &&
    mapped.z <= 1 + FACE_TOLERANCE
  );
}

const nothing = new THREE.Sphere(new THREE.Vector3(), 1e6);

describe('DirectionalSplitShadow.setSplits', () => {
  it('lays four splits out as quadrants of the atlas', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(4, ATLAS_SIZE);
    expect(shadow.mapSize.toArray()).toEqual([2048, 2048]);
    expect(shadow.getFrameExtents().toArray()).toEqual([2, 2]);
    expect(shadow.getViewport(3).toArray()).toEqual([1, 1, 1, 1]);
  });

  it('lays two splits out as halves of the atlas height, drawing nothing in the last slots', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(2, ATLAS_SIZE);
    expect(shadow.mapSize.toArray()).toEqual([4096, 2048]);
    expect(shadow.getFrameExtents().toArray()).toEqual([1, 2]);
    expect(shadow.getViewport(1).toArray()).toEqual([0, 1, 1, 1]);
    expect(shadow.getViewport(2).toArray()).toEqual([0, 0, 0, 0]);
  });

  it('keeps four slots for every split count, as the shader expects (edge case)', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(2, ATLAS_SIZE);
    expect(shadow.getViewportCount()).toBe(SPLIT_SLOTS);
  });

  it('draws nothing into any slot for a count with no split (error case)', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(0, ATLAS_SIZE);
    expect(() => shadow.updateMatrices(new THREE.DirectionalLight())).not.toThrow();
    for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
      expect(shadow.getFrustum(slot).intersectsSphere(nothing)).toBe(false);
    }
  });
});

describe('DirectionalSplitShadow.updateMatrices', () => {
  it('maps each of four splits’ slices into its own quadrant', () => {
    const camera = viewingCamera();
    const shadow = fittedShadow(camera, 4);
    const starts = [0.05, 8.045, 16.04, 40.025];
    const ends = [8.045, 16.04, 40.025, 80];
    for (let split = 0; split < 4; split++) {
      const rect = directionalShadowSplitAtlasRect(4, split, ATLAS_SIZE);
      for (const corner of cameraSliceCorners(camera, starts[split]!, ends[split]!)) {
        expect(landsIn(shadow.getMatrix(split), corner, rect)).toBe(true);
      }
    }
  });

  it('maps each of two splits’ slices into its own half', () => {
    const camera = viewingCamera();
    const shadow = fittedShadow(camera, 2);
    const rect = directionalShadowSplitAtlasRect(2, 1, ATLAS_SIZE);
    for (const corner of cameraSliceCorners(camera, 8.045, 80)) {
      expect(landsIn(shadow.getMatrix(1), corner, rect)).toBe(true);
    }
  });

  it('repeats the last split’s matrix in the undrawn slots (edge case)', () => {
    const shadow = fittedShadow(viewingCamera(), 2);
    expect(shadow.getMatrix(3).equals(shadow.getMatrix(1))).toBe(true);
  });

  it('culls every caster from an undrawn slot', () => {
    const shadow = fittedShadow(viewingCamera(), 2);
    expect(shadow.getFrustum(1).intersectsSphere(new THREE.Sphere(new THREE.Vector3(), 1))).toBe(true);
    expect(shadow.getFrustum(2).intersectsSphere(nothing)).toBe(false);
  });

  it('rolls every split camera by the up the fitter fits with (edge case)', () => {
    const shadow = new DirectionalSplitShadow();
    for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
      expect(shadow.getCamera(slot).up.equals(SPLIT_CAMERA_UP)).toBe(true);
    }
  });
});
