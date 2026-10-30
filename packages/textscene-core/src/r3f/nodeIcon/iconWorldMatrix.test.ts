/**
 * The world matrix of a node icon: a quad of ±0.05 that faces the camera at a fixed on-screen size
 * (`node_3d_editor_gizmos.cpp:331-337`, `material.cpp:1357-1381`). Each size is the quad's screen
 * height in pixels, projected through the camera, against a hand-worked number: the quad is
 * 0.1 of the view depth tall, and a perspective view is 2 * tan(fov / 2) of the depth tall, so at a
 * fov of 70 degrees the icon is 0.1 / (2 * tan 35) = 0.0714 of the viewport height.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { iconWorldMatrix } from './iconWorldMatrix';

const FOV = 70;

function perspectiveCameraAt(position: [number, number, number], aspect = 16 / 9): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 100);
  camera.position.set(...position);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

/** The pixel size of the icon at `origin`, on a viewport `viewportHeight` pixels tall. */
function screenSize(camera: THREE.Camera, origin: THREE.Vector3, viewportHeight: number, aspect = 16 / 9) {
  const matrix = iconWorldMatrix(new THREE.Matrix4(), origin, camera);
  const project = (x: number, y: number) => new THREE.Vector3(x, y, 0).applyMatrix4(matrix).project(camera);
  const [topRight, bottomLeft] = [project(0.05, 0.05), project(-0.05, -0.05)];
  return {
    height: ((topRight.y - bottomLeft.y) / 2) * viewportHeight,
    width: ((topRight.x - bottomLeft.x) / 2) * viewportHeight * aspect,
  };
}

describe('iconWorldMatrix', () => {
  it.each([
    [360, 2, 25.706],
    [360, 10, 25.706],
    [720, 2, 51.412],
    [720, 10, 51.412],
  ])('is %i px tall at view depth %i in perspective: %f px', (viewportHeight, depth, expected) => {
    const camera = perspectiveCameraAt([0, 0, depth]);
    expect(screenSize(camera, new THREE.Vector3(), viewportHeight).height).toBeCloseTo(expected, 2);
  });

  it('is 0.05 of the viewport height in orthogonal', () => {
    const camera = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.updateMatrixWorld();
    expect(screenSize(camera, new THREE.Vector3(), 720).height).toBeCloseTo(0.05 * 720, 6);
  });

  it('keeps one size for an origin off the view axis at the same depth', () => {
    const camera = perspectiveCameraAt([0, 0, 10]);
    const centre = screenSize(camera, new THREE.Vector3(0, 0, 0), 720).height;
    expect(screenSize(camera, new THREE.Vector3(3, 2, 0), 720).height).toBeCloseTo(centre, 6);
  });

  it('faces the camera and stays square from an oblique view', () => {
    const camera = perspectiveCameraAt([3, 4, 5]);
    const { width, height } = screenSize(camera, new THREE.Vector3(), 720);
    expect(width).toBeCloseTo(height, 6);
  });

  it('puts the origin at the node and drops the scale of the node', () => {
    const camera = perspectiveCameraAt([0, 0, 10]);
    const matrix = iconWorldMatrix(new THREE.Matrix4(), new THREE.Vector3(1, 2, 3), camera);
    expect(new THREE.Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([1, 2, 3]);
  });
});
