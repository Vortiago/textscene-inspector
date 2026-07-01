/**
 * Integration test for UV transform with shared textures.
 * Tests that multiple materials can use the same texture with different UV
 * transforms, and that createStandardMaterial clones the shared source texture
 * per material so their UV repeats don't interfere with each other.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createStandardMaterial } from './renderer';

describe('UV Transform Integration - Shared Textures', () => {
  it('should apply different UV transforms to materials sharing the same texture', () => {
    // A single shared source texture, as if resolved once from ExtResource("1").
    const sharedTexture = new THREE.Texture();

    const material1 = createStandardMaterial({
      albedo_texture: sharedTexture,
      uv1_scale: { x: 2, y: 2, z: 1 },
    });
    const material2 = createStandardMaterial({
      albedo_texture: sharedTexture,
      uv1_scale: { x: 4, y: 4, z: 1 },
    });

    // Verify both materials have textures
    expect(material1.map).toBeDefined();
    expect(material2.map).toBeDefined();

    // material1: uv1_scale=2.0 -> repeat=2.0; material2: uv1_scale=4.0 -> repeat=4.0
    expect(material1.map!.repeat.x).toBe(2.0);
    expect(material1.map!.repeat.y).toBe(2.0);

    expect(material2.map!.repeat.x).toBe(4.0);
    expect(material2.map!.repeat.y).toBe(4.0);

    // The shared source texture is cloned per material, so the two maps are
    // distinct objects and neither is the shared source itself.
    expect(material1.map).not.toBe(material2.map);
    expect(material1.map).not.toBe(sharedTexture);
    expect(material2.map).not.toBe(sharedTexture);
  });

  it('should handle six materials with different UV scales (showcase scenario)', () => {
    const sharedTexture = new THREE.Texture();

    // Six different UV scales like in the showcase fixture
    const uvScales = [0.25, 0.5, 1.0, 2.0, 4.0, 8.0];

    const materials: THREE.MeshStandardMaterial[] = uvScales.map((scale) =>
      createStandardMaterial({
        albedo_texture: sharedTexture,
        uv1_scale: { x: scale, y: scale, z: 1 },
      })
    );

    // Verify all materials have the expected per-material repeat values
    for (let i = 0; i < materials.length; i++) {
      const material = materials[i]!;
      const expectedRepeat = uvScales[i]!;

      expect(material.map).toBeDefined();
      expect(material.map!.repeat.x).toBeCloseTo(expectedRepeat, 5);
      expect(material.map!.repeat.y).toBeCloseTo(expectedRepeat, 5);
    }

    // Verify all textures are different objects (cloned per material)
    const uniqueTextures = new Set(materials.map((m) => m.map));
    expect(uniqueTextures.size).toBe(6); // Should have 6 different texture objects
  });
});
