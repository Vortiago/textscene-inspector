import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { sceneHasBloomableEmissive } from './bloomableScan';

/**
 * A mesh whose material carries the given emissive colour and intensity. The scan
 * reads live THREE materials, so these are built the way the render layer leaves
 * them rather than from parsed properties.
 */
function emissiveMesh(emissive: [number, number, number], intensity: number): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial();
  material.emissive = new THREE.Color().fromArray(emissive);
  material.emissiveIntensity = intensity;
  return new THREE.Mesh(new THREE.BufferGeometry(), material);
}

function sceneOf(...objects: THREE.Object3D[]): THREE.Scene {
  const scene = new THREE.Scene();
  for (const object of objects) scene.add(object);
  return scene;
}

describe('sceneHasBloomableEmissive', () => {
  it('is false for an empty scene', () => {
    expect(sceneHasBloomableEmissive(sceneOf(), 1)).toBe(false);
  });

  it('gates on the PEAK channel times intensity, matching the bright pass', () => {
    // The bright pass takes `max(r, g, b)`, so a saturated blue emissive counts by
    // its blue channel alone — by Rec.709 luminance it would be the dimmest thing
    // in the frame and would never be found.
    const blue = emissiveMesh([0, 0, 1], 2.3);
    expect(sceneHasBloomableEmissive(sceneOf(blue), 1)).toBe(true);
  });

  it('is false when peak times intensity only reaches the threshold', () => {
    // The bright pass uses a smoothstep starting AT the threshold, so a pixel
    // exactly on it contributes nothing.
    expect(sceneHasBloomableEmissive(sceneOf(emissiveMesh([1, 1, 1], 1)), 1)).toBe(false);
    expect(sceneHasBloomableEmissive(sceneOf(emissiveMesh([1, 1, 1], 1.01)), 1)).toBe(true);
  });

  it('ignores a bright colour at zero intensity', () => {
    expect(sceneHasBloomableEmissive(sceneOf(emissiveMesh([1, 1, 1], 0)), 1)).toBe(false);
  });

  it('finds an emissive nested deep in the graph', () => {
    // Instanced sub-scenes and GLB imports arrive as nested groups, so a scan that
    // only looked at direct children would miss most real content.
    const inner = new THREE.Group();
    inner.add(emissiveMesh([2, 0, 0], 1));
    const outer = new THREE.Group();
    outer.add(inner);
    expect(sceneHasBloomableEmissive(sceneOf(outer), 1)).toBe(true);
  });

  it('finds an emissive in any slot of a multi-material mesh', () => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), [
      new THREE.MeshStandardMaterial(),
      (emissiveMesh([3, 0, 0], 1).material as THREE.MeshStandardMaterial),
    ]);
    expect(sceneHasBloomableEmissive(sceneOf(mesh), 1)).toBe(true);
  });

  it('tolerates objects with no material and materials with no emissive', () => {
    const bare = new THREE.Object3D();
    const basic = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    expect(sceneHasBloomableEmissive(sceneOf(bare, basic), 1)).toBe(false);
  });

  it('follows the threshold it is given', () => {
    const dim = sceneOf(emissiveMesh([0.5, 0, 0], 1));
    expect(sceneHasBloomableEmissive(dim, 1)).toBe(false);
    expect(sceneHasBloomableEmissive(dim, 0.25)).toBe(true);
  });
});
