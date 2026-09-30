/**
 * The fit is checked through three's own shadow matrices: a box is right when
 * `LightShadow.updateMatrices` maps what it must cover into the map's unit cube.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  cameraSliceCorners,
  fitDirectionalShadowBox,
  orthogonalShadowFade,
  viewSlice,
  type DirectionalShadowBox,
  type DirectionalShadowFitInput,
} from './fitDirectionalShadowBox';

const MAP_SIZE = 2048;
/** The sun's travel direction: down and away, as in most outdoor scenes. */
const SUN_DIRECTION = new THREE.Vector3(-0.4, -0.8, -0.45).normalize();
/** Float slack for a point that sits on a box face. */
const FACE_TOLERANCE = 1e-9;

/** The split fields of an orthogonal light, which the single box never reads. */
const ONE_SPLIT = { splitCount: 1, splitOffsets: [0.1, 0.2, 0.5], blendSplits: false };

function declaring(maxDistance: number, pancakeSize = 20): DirectionalShadowFitInput['declaration'] {
  return { maxDistance, pancakeSize, fadeStart: 0.8, depthBias: 0, normalBias: 2, ...ONE_SPLIT };
}

function perspectiveCamera(far = 4000): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, far);
  camera.position.set(5.5, 25, 90);
  camera.lookAt(5.5, 12, 0);
  camera.updateMatrixWorld();
  return camera;
}

function sunAt(position: THREE.Vector3): Pick<DirectionalShadowFitInput, 'lightPosition' | 'targetPosition'> {
  return { lightPosition: position, targetPosition: position.clone().add(SUN_DIRECTION) };
}

function fitInput(overrides: Partial<DirectionalShadowFitInput> = {}): DirectionalShadowFitInput {
  return {
    camera: perspectiveCamera(),
    ...sunAt(new THREE.Vector3(11, 12.3, -31)),
    up: new THREE.Vector3(0, 1, 0),
    declaration: { maxDistance: 80, pancakeSize: 20, fadeStart: 0.8, depthBias: -0.0003, normalBias: 2, ...ONE_SPLIT },
    shadowMapSize: MAP_SIZE,
    ...overrides,
  };
}

function fit(overrides: Partial<DirectionalShadowFitInput> = {}): DirectionalShadowBox {
  const box = fitDirectionalShadowBox(fitInput(overrides));
  if (!box) throw new Error('expected a finite shadow box, got null');
  return box;
}

/** three's world-to-map matrix for a light carrying `box`, as the shadow pass builds it. */
function shadowMatrix(input: DirectionalShadowFitInput, box: DirectionalShadowBox): THREE.Matrix4 {
  const light = new THREE.DirectionalLight();
  light.position.copy(input.lightPosition);
  light.target.position.copy(input.targetPosition);
  light.shadow.camera.up.copy(input.up);
  Object.assign(light.shadow.camera, {
    left: box.left,
    right: box.right,
    top: box.top,
    bottom: box.bottom,
    near: box.near,
    far: box.far,
  });
  light.shadow.camera.updateProjectionMatrix();
  light.updateMatrixWorld();
  light.target.updateMatrixWorld();
  light.shadow.updateMatrices(light);
  return light.shadow.matrix;
}

/** The point in map space: x and y are texture coordinates, z is depth, all in [0, 1] inside. */
function inMap(matrix: THREE.Matrix4, point: THREE.Vector3): THREE.Vector3 {
  return point.clone().applyMatrix4(matrix);
}

function isInsideMap(mapped: THREE.Vector3): boolean {
  return [mapped.x, mapped.y, mapped.z].every(
    (value) => value >= -FACE_TOLERANCE && value <= 1 + FACE_TOLERANCE
  );
}

function sliceCorners(input: DirectionalShadowFitInput, far: number): THREE.Vector3[] {
  return cameraSliceCorners(input.camera, input.camera.near, far);
}

describe('fitDirectionalShadowBox', () => {
  it('covers every corner of the camera slice up to the max distance', () => {
    const input = fitInput();
    const matrix = shadowMatrix(input, fit());
    for (const corner of sliceCorners(input, 80)) {
      expect(isInsideMap(inMap(matrix, corner))).toBe(true);
    }
  });

  it('puts the same box in the world wherever the light node stands', () => {
    const near = fitInput(sunAt(new THREE.Vector3(0, 0, 0)));
    const far = fitInput(sunAt(new THREE.Vector3(300, -40, 900)));
    const a = shadowMatrix(near, fit(near)).elements;
    const b = shadowMatrix(far, fit(far)).elements;
    a.forEach((value, i) => expect(value).toBeCloseTo(b[i]!, 6));
  });

  it('fits the slice that ends at the max distance, not at the camera far plane', () => {
    const clamped = fit({ camera: perspectiveCamera(4000), declaration: declaring(80) });
    const cameraAt80 = fit({ camera: perspectiveCamera(80), declaration: declaring(0) });
    expect(clamped.right - clamped.left).toBeCloseTo(cameraAt80.right - cameraAt80.left, 9);
  });

  it('keeps the camera far plane when it is nearer than the max distance', () => {
    const short = fit({ camera: perspectiveCamera(50), declaration: declaring(80) });
    const unclamped = fit({ camera: perspectiveCamera(50), declaration: declaring(0) });
    expect(short).toEqual(unclamped);
  });

  it('ignores the max distance for an orthogonal camera', () => {
    const ortho = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.05, 300);
    ortho.position.set(0, 20, 40);
    ortho.lookAt(0, 0, 0);
    ortho.updateMatrixWorld();
    const withMax = fit({ camera: ortho, declaration: declaring(80) });
    const withoutMax = fit({ camera: ortho, declaration: declaring(0) });
    expect(withMax).toEqual(withoutMax);
  });

  it('fits a light that points straight down, parallel to the shadow camera up (edge case)', () => {
    const position = new THREE.Vector3(0, 10, 0);
    const input = fitInput({ lightPosition: position, targetPosition: new THREE.Vector3(0, 0, 0) });
    const box = fit(input);
    const matrix = shadowMatrix(input, box);
    for (const corner of sliceCorners(input, 80)) {
      expect(isInsideMap(inMap(matrix, corner))).toBe(true);
    }
  });

  it('reaches one slice diameter past the near face towards the light', () => {
    const input = fitInput();
    const box = fit(input);
    const centre = new THREE.Vector3();
    sliceCorners(input, 80).forEach((corner) => centre.add(corner));
    centre.divideScalar(8);
    const radius = (box.right - box.left) / 2;
    // Just inside the reach: the near face sits one radius plus the pancake from the centre.
    const reached = centre.clone().addScaledVector(SUN_DIRECTION, -(3 * radius + 20 - 1));
    expect(isInsideMap(inMap(shadowMatrix(input, box), reached))).toBe(true);
  });

  it('spends the declared bias over Godot’s depth range, not the lengthened one', () => {
    const box = fit();
    // Godot's range is 2r + pancake. The reach adds 2r more, so three's range is 4r + pancake.
    const threeDepth = box.far - box.near;
    const godotDepth = (threeDepth - 20) / 2 + 20;
    expect(box.bias).toBeCloseTo((-0.0003 * godotDepth) / threeDepth, 15);
  });

  it('does not reach past the near face when the pancake size is zero (edge case)', () => {
    const box = fit({ declaration: { ...declaring(80, 0), depthBias: -0.0003 } });
    // Godot's own depth range is the sphere's diameter, and nothing lengthens it.
    expect(box.far - box.near).toBeCloseTo(box.right - box.left, 0);
    expect(box.bias).toBeCloseTo(-0.0003, 15);
  });

  it('turns the normal bias from texels into world units', () => {
    const box = fit();
    const texel = (box.right - box.left) / MAP_SIZE;
    // Snapping moves each edge by at most half a step, two texels over the map.
    expect(box.normalBias / 2).toBeCloseTo(texel, 2);
  });

  it('answers null for a camera whose projection cannot be inverted (error case)', () => {
    const camera = perspectiveCamera();
    camera.projectionMatrixInverse.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    expect(fitDirectionalShadowBox(fitInput({ camera }))).toBeNull();
  });
});

describe('fitDirectionalShadowBox over given depths', () => {
  it('covers every corner of the depths it is given', () => {
    const input = fitInput();
    const box = fitDirectionalShadowBox(input, { near: 20, far: 40 })!;
    const matrix = shadowMatrix(input, box);
    for (const corner of cameraSliceCorners(input.camera, 20, 40)) {
      expect(isInsideMap(inMap(matrix, corner))).toBe(true);
    }
  });

  it('fits a narrower box to a near part of the slice than to the whole', () => {
    const near = fitDirectionalShadowBox(fitInput(), { near: 0.05, far: 8 })!;
    expect((near.right - near.left) * 4).toBeLessThan(fit().right - fit().left);
  });

  it('answers the whole slice by default (edge case)', () => {
    const input = fitInput();
    expect(fitDirectionalShadowBox(input)).toEqual(fitDirectionalShadowBox(input, viewSlice(input)));
  });

  it('answers null for depths that are not finite (error case)', () => {
    expect(fitDirectionalShadowBox(fitInput(), { near: 0.05, far: Number.NaN })).toBeNull();
  });
});

describe('viewSlice', () => {
  it('ends at the max distance for a perspective camera', () => {
    expect(viewSlice(fitInput())).toEqual({ near: 0.05, far: 80 });
  });

  it('ends at the camera far plane for a max distance of zero (edge case)', () => {
    expect(viewSlice(fitInput({ declaration: declaring(0) }))).toEqual({ near: 0.05, far: 4000 });
  });

  it('keeps the far end past the near end for a camera with an empty range (error case)', () => {
    const slice = viewSlice(fitInput({ camera: perspectiveCamera(0.01) }));
    expect(slice.far).toBeCloseTo(0.051, 9);
    expect(slice.near).toBe(0.05);
  });
});

describe('cameraSliceCorners', () => {
  it('widens with depth for a perspective camera', () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 1, 100);
    camera.updateMatrixWorld();
    const corners = cameraSliceCorners(camera, 2, 10);
    const xs = corners.map((corner) => Math.abs(corner.x));
    expect(Math.min(...xs)).toBeCloseTo(2, 9);
    expect(Math.max(...xs)).toBeCloseTo(10, 9);
    expect(corners.map((corner) => corner.z).sort((a, b) => a - b)[0]).toBeCloseTo(-10, 9);
  });

  it('keeps its width at every depth for an orthogonal camera', () => {
    const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
    camera.updateMatrixWorld();
    for (const corner of cameraSliceCorners(camera, 1, 50)) {
      expect(Math.abs(corner.x)).toBeCloseTo(4, 9);
    }
  });

  it('answers eight identical-depth pairs for an empty slice (edge case)', () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 1, 100);
    camera.updateMatrixWorld();
    const depths = cameraSliceCorners(camera, 5, 5).map((corner) => corner.z);
    depths.forEach((depth) => expect(depth).toBeCloseTo(-5, 9));
  });

  it('answers non-finite corners for a camera with no depth range (error case)', () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 1, 100);
    camera.projectionMatrixInverse.identity().makeScale(1, 1, 0);
    camera.updateMatrixWorld();
    const corners = cameraSliceCorners(camera, 1, 10);
    expect(corners.some((corner) => !Number.isFinite(corner.x))).toBe(true);
  });
});

describe('orthogonalShadowFade', () => {
  it('fades the shadow out from the fade start of the max distance to its end', () => {
    expect(orthogonalShadowFade(fitInput())).toEqual({ from: expect.closeTo(64, 12), to: 80 });
  });

  it('ends the fade at the camera far plane when it is nearer than the max distance (edge case)', () => {
    const fade = orthogonalShadowFade(fitInput({ camera: perspectiveCamera(50), declaration: declaring(80) }));
    expect(fade.to).toBe(50);
    expect(fade.from).toBeCloseTo(40, 12);
  });

  it('keeps a finite fade for a nan fade start (error case)', () => {
    const fade = orthogonalShadowFade(fitInput({ declaration: { ...declaring(80), fadeStart: Number.NaN } }));
    expect(fade.from).toBeCloseTo(79.92, 12);
  });
});
