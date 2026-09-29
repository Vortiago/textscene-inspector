/**
 * <GridMap> tiles whose ArrayMesh declares no surface material. A MeshLibrary
 * item has no material of its own, so Godot binds its default shader, as for
 * any material-less surface. The stand-in must be that default, not a grey.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderInstancedTile } from './testing/gridMapCorpus';

describe('<GridMap> tile whose ArrayMesh declares no material', () => {
  it('instances the tile once the mesh resolves', async () => {
    expect(await renderInstancedTile()).toBeInstanceOf(THREE.InstancedMesh);
  });

  it('paints it with Godot’s default material', async () => {
    const material = (await renderInstancedTile()).material as THREE.MeshStandardMaterial;
    const rgb = material.color.getRGB(
      { r: 0, g: 0, b: 0 } as THREE.Color,
      THREE.LinearSRGBColorSpace
    );
    expect(rgb.r).toBeCloseTo(0.6, 5);
    expect(rgb.g).toBeCloseTo(0.6, 5);
    expect(rgb.b).toBeCloseTo(0.6, 5);
    expect(material.roughness).toBe(0.8);
    expect(material.metalness).toBe(0.2);
  });
});
