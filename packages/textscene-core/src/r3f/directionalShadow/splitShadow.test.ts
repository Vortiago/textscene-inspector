/**
 * The atlas is checked through the matrices three samples with: a split is right when its matrix
 * maps its own slice into its own rectangle of the atlas, in texture coordinates.
 */
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { DirectionalSplitShadow, SPLIT_CAMERA_UP, SPLIT_SLOTS } from './splitShadow';
import { directionalShadowUserData } from './declaration';
import { fitSceneDirectionalShadows } from './fitSceneDirectionalShadows';
import { cameraSliceCorners } from './fitDirectionalShadowBox';
import { splitSunOf } from './splitSun';
import {
  directionalShadowSplitAtlasRect,
  type DirectionalShadowAtlasRect,
} from '../../godot/directionalShadow';

const ATLAS_SIZE = 4096;
const WHOLE_ATLAS = { x: 0, y: 0, width: ATLAS_SIZE, height: ATLAS_SIZE };
/** The second of two lights' shares: half the atlas's width at its full height. */
const SECOND_OF_TWO = { x: 2048, y: 0, width: 2048, height: ATLAS_SIZE };
const FACE_TOLERANCE = 1e-9;

function viewingCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 4000);
  camera.position.set(0, 10, 40);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

function declaredSplitLight(splitCount: number): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight();
  light.position.set(10, 20, 5);
  light.castShadow = true;
  light.userData = directionalShadowUserData({
    maxDistance: 80,
    pancakeSize: 20,
    fadeStart: 0.8,
    depthBias: 0,
    normalBias: 2,
    filterRadius: 2,
    splitCount,
    splitOffsets: [0.1, 0.2, 0.5],
    blendSplits: false,
    sharesAtlas: true,
  });
  return light;
}

/**
 * The split shadow of the last of `lightCount` split lights fitted to `camera`, its matrices
 * updated as the shadow pass does.
 */
function fittedShadow(
  camera: THREE.PerspectiveCamera,
  splitCount: number,
  lightCount = 1
): DirectionalSplitShadow {
  const scene = new THREE.Scene();
  const lights = Array.from({ length: lightCount }, () => declaredSplitLight(splitCount));
  for (const light of lights) scene.add(light, light.target);
  scene.updateMatrixWorld();
  fitSceneDirectionalShadows(scene, camera);
  const sun = splitSunOf(lights[lightCount - 1]!)!;
  sun.shadow.updateMatrices(sun);
  return sun.shadow;
}

/**
 * Whether `point` lands inside the split `rect` of the light's own `lightRect`, in the texture
 * coordinates of the light's own texture, and inside its depth.
 */
function landsIn(
  matrix: THREE.Matrix4,
  point: THREE.Vector3,
  rect: DirectionalShadowAtlasRect,
  lightRect: DirectionalShadowAtlasRect = WHOLE_ATLAS
): boolean {
  const mapped = point.clone().applyMatrix4(matrix);
  const within = (value: number, start: number, size: number, textureSize: number) =>
    value >= start / textureSize - FACE_TOLERANCE && value <= (start + size) / textureSize + FACE_TOLERANCE;
  return (
    within(mapped.x, rect.x - lightRect.x, rect.width, lightRect.width) &&
    within(mapped.y, rect.y - lightRect.y, rect.height, lightRect.height) &&
    mapped.z >= -FACE_TOLERANCE &&
    mapped.z <= 1 + FACE_TOLERANCE
  );
}

const nothing = new THREE.Sphere(new THREE.Vector3(), 1e6);

describe('DirectionalSplitShadow.setSplits', () => {
  it('lays four splits out as quadrants of the atlas', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(4, WHOLE_ATLAS);
    expect(shadow.mapSize.toArray()).toEqual([2048, 2048]);
    expect(shadow.getFrameExtents().toArray()).toEqual([2, 2]);
    expect(shadow.getViewport(3).toArray()).toEqual([1, 1, 1, 1]);
  });

  it('lays two splits out as halves of the atlas height, drawing nothing in the last slots', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(2, WHOLE_ATLAS);
    expect(shadow.mapSize.toArray()).toEqual([4096, 2048]);
    expect(shadow.getFrameExtents().toArray()).toEqual([1, 2]);
    expect(shadow.getViewport(1).toArray()).toEqual([0, 1, 1, 1]);
    expect(shadow.getViewport(2).toArray()).toEqual([0, 0, 0, 0]);
  });

  it('lays four splits out as quadrants of a light’s share of the atlas, which is not square', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(4, SECOND_OF_TWO);
    expect(shadow.mapSize.toArray()).toEqual([1024, 2048]);
    expect(shadow.getFrameExtents().toArray()).toEqual([2, 2]);
    expect(shadow.getViewport(1).toArray()).toEqual([1, 0, 1, 1]);
    expect(shadow.getViewport(3).toArray()).toEqual([1, 1, 1, 1]);
  });

  it('lays two splits out as halves of a light’s share of the atlas', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(2, SECOND_OF_TWO);
    expect(shadow.mapSize.toArray()).toEqual([2048, 2048]);
    expect(shadow.getFrameExtents().toArray()).toEqual([1, 2]);
    expect(shadow.getViewport(1).toArray()).toEqual([0, 1, 1, 1]);
  });

  it('keeps its texture for three to resize when the share changes size', () => {
    // three resizes a map whose size no longer matches `mapSize` × the frame extents (r186
    // `WebGLShadowMap.js:281-285`).
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(4, WHOLE_ATLAS);
    const texture = new THREE.WebGLRenderTarget(ATLAS_SIZE, ATLAS_SIZE);
    shadow.map = texture;
    shadow.setSplits(4, SECOND_OF_TWO);
    expect(shadow.map).toBe(texture);
    expect(shadow.mapSize.clone().multiply(shadow.getFrameExtents()).toArray()).toEqual([2048, 4096]);
  });

  it('keeps its texture while the share keeps its size (edge case)', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(4, WHOLE_ATLAS);
    const texture = new THREE.WebGLRenderTarget(ATLAS_SIZE, ATLAS_SIZE);
    shadow.map = texture;
    shadow.setSplits(4, WHOLE_ATLAS);
    shadow.setSplits(2, WHOLE_ATLAS);
    expect(shadow.map).toBe(texture);
  });

  it('keeps four slots for every split count, as the shader expects (edge case)', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(2, WHOLE_ATLAS);
    expect(shadow.getViewportCount()).toBe(SPLIT_SLOTS);
  });

  it('draws nothing into any slot for a count with no split (error case)', () => {
    const shadow = new DirectionalSplitShadow();
    shadow.setSplits(0, WHOLE_ATLAS);
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
      const rect = directionalShadowSplitAtlasRect(4, split, WHOLE_ATLAS);
      for (const corner of cameraSliceCorners(camera, starts[split]!, ends[split]!)) {
        expect(landsIn(shadow.getMatrix(split), corner, rect)).toBe(true);
      }
    }
  });

  it('maps each of two splits’ slices into its own half', () => {
    const camera = viewingCamera();
    const shadow = fittedShadow(camera, 2);
    const rect = directionalShadowSplitAtlasRect(2, 1, WHOLE_ATLAS);
    for (const corner of cameraSliceCorners(camera, 8.045, 80)) {
      expect(landsIn(shadow.getMatrix(1), corner, rect)).toBe(true);
    }
  });

  it('maps each of four splits’ slices into its own quadrant of a light’s share of the atlas', () => {
    const camera = viewingCamera();
    const shadow = fittedShadow(camera, 4, 2);
    const starts = [0.05, 8.045, 16.04, 40.025];
    const ends = [8.045, 16.04, 40.025, 80];
    for (let split = 0; split < 4; split++) {
      const rect = directionalShadowSplitAtlasRect(4, split, SECOND_OF_TWO);
      for (const corner of cameraSliceCorners(camera, starts[split]!, ends[split]!)) {
        expect(landsIn(shadow.getMatrix(split), corner, rect, SECOND_OF_TWO)).toBe(true);
      }
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

  it('culls a caster from an undrawn slot without reading its bounds (edge case)', () => {
    // three's shadow pass asks each caster through `intersectsObject` (r186 `Mesh.js:228`).
    const shadow = fittedShadow(viewingCamera(), 2);
    const caster = new THREE.Mesh(new THREE.BoxGeometry());
    const bounds = vi.spyOn(caster.geometry, 'computeBoundingSphere');
    expect(shadow.getFrustum(3).intersectsObject(caster)).toBe(false);
    expect(shadow.getFrustum(1).intersectsObject(caster)).toBe(true);
    expect(bounds).toHaveBeenCalledOnce();
  });

  it('rebuilds a split’s projection when three reverses the depth buffer (edge case)', () => {
    const shadow = fittedShadow(viewingCamera(), 4);
    const forwardDepth = shadow.getCamera(0).projectionMatrix.clone();
    (shadow.camera as unknown as { _reversedDepth: boolean })._reversedDepth = true;
    shadow.updateMatrices(new THREE.DirectionalLight());
    expect(shadow.getCamera(0).reversedDepth).toBe(true);
    expect(shadow.getCamera(0).projectionMatrix.equals(forwardDepth)).toBe(false);
  });

  it('rolls every split camera by the up the fitter fits with (edge case)', () => {
    const shadow = new DirectionalSplitShadow();
    for (let slot = 0; slot < SPLIT_SLOTS; slot++) {
      expect(shadow.getCamera(slot).up.equals(SPLIT_CAMERA_UP)).toBe(true);
    }
  });
});
