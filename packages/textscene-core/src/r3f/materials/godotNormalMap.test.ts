import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GODOT_NORMAL_MAP_READ, importedNormalMapRead, withImportedNormalMapRead } from './godotNormalMap';
import { REBUILDS_NORMAL_MAP_BLUE, patchedFragment } from '../testing/patchedFragment';

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

describe('withImportedNormalMapRead', () => {
  it('rebuilds blue in the program of a normal-mapped material', () => {
    expect(patchedFragment(withImportedNormalMapRead(normalMapped()))).toContain(REBUILDS_NORMAL_MAP_BLUE);
  });

  it('leaves a material without a normal map unpatched', () => {
    const material = new THREE.MeshStandardMaterial();
    const onBeforeCompile = material.onBeforeCompile;
    expect(withImportedNormalMapRead(material).onBeforeCompile).toBe(onBeforeCompile);
  });

  it('returns the material it was given (edge case)', () => {
    const material = normalMapped();
    expect(withImportedNormalMapRead(material)).toBe(material);
  });
});
