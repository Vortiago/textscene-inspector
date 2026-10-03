import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { omniShadowCoverage, spotShadowCoverage } from './shadowCoverage';

const NEAR = 0.05;

/** At the origin, looking down -z, with a square 90-degree view: each near-plane half extent is `NEAR`. */
function squareCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(90, 1, NEAR, 100);
  camera.updateMatrixWorld();
  return camera;
}

describe('omniShadowCoverage', () => {
  it('is the projected range diameter over the summed near-plane half extents', () => {
    // A range of 2 at depth 10 projects to 0.2 of the near distance: 2 * 0.2 / (1 + 1).
    expect(omniShadowCoverage(new THREE.Vector3(0, 0, -10), 2, squareCamera())).toBeCloseTo(0.2, 9);
  });

  it('halves when the light is twice as far', () => {
    expect(omniShadowCoverage(new THREE.Vector3(0, 0, -20), 2, squareCamera())).toBeCloseTo(0.1, 9);
  });

  it('measures an orthogonal camera in world units, at any depth', () => {
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, NEAR, 100);
    camera.updateMatrixWorld();
    // A diameter of 2 over half extents of 5 and 5.
    expect(omniShadowCoverage(new THREE.Vector3(3, 1, -40), 1, camera)).toBeCloseTo(0.2, 9);
  });

  it('moves a point nearer than the near plane onto it, as Godot does (edge case)', () => {
    // Both points take z = -NEAR and already lie on the plane, so the range stays unprojected.
    expect(omniShadowCoverage(new THREE.Vector3(0, 0, 0), 1, squareCamera())).toBeCloseTo(1 / NEAR, 6);
  });

  it('is NaN for a non-finite range (error case)', () => {
    expect(omniShadowCoverage(new THREE.Vector3(0, 0, -10), Number.NaN, squareCamera())).toBeNaN();
  });

  it('leaves the caller’s position where it was (edge case)', () => {
    const position = new THREE.Vector3(0, 0, 0);
    omniShadowCoverage(position, 1, squareCamera());
    expect(position.toArray()).toEqual([0, 0, 0]);
  });

  it('measures each call alone, whatever the call before it measured', () => {
    omniShadowCoverage(new THREE.Vector3(0, 0, 0), 1, squareCamera());
    expect(omniShadowCoverage(new THREE.Vector3(0, 0, -10), 2, squareCamera())).toBeCloseTo(0.2, 9);
  });
});

describe('spotShadowCoverage', () => {
  const forward = new THREE.Vector3(0, 0, -1);

  it('measures the radius of the cone base, one range away at the cone edge', () => {
    const angle = Math.PI / 6;
    const baseDepth = 5 + 5 * Math.cos(angle);
    const expected = (2 * 5 * Math.sin(angle)) / baseDepth / 2;
    const coverage = spotShadowCoverage(new THREE.Vector3(0, 0, -5), forward, 5, angle, squareCamera());
    expect(coverage).toBeCloseTo(expected, 9);
  });

  it('is zero for a cone with no width (edge case)', () => {
    expect(spotShadowCoverage(new THREE.Vector3(0, 0, -5), forward, 5, 0, squareCamera())).toBeCloseTo(0, 12);
  });

  it('is NaN for a non-finite angle (error case)', () => {
    expect(spotShadowCoverage(new THREE.Vector3(0, 0, -5), forward, 5, Number.NaN, squareCamera())).toBeNaN();
  });
});
