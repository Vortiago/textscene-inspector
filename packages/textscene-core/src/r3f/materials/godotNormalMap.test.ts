import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GODOT_NORMAL_MAP_READ, importedNormalMapRead } from './godotNormalMap';

const normalMapped = () => new THREE.MeshStandardMaterial({ normalMap: new THREE.Texture() });

describe('importedNormalMapRead', () => {
  it("is Godot's read for a material with a normal map", () => {
    expect(importedNormalMapRead(normalMapped())).toBe(GODOT_NORMAL_MAP_READ);
  });

  it('is none for a material without one', () => {
    expect(importedNormalMapRead(new THREE.MeshStandardMaterial())).toBeUndefined();
  });

  it('is none for a material that has no normal map slot (edge case)', () => {
    expect(importedNormalMapRead(new THREE.MeshBasicMaterial())).toBeUndefined();
  });
});
