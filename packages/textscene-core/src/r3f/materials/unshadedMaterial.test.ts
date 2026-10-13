import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { UnshadedMaterial } from './unshadedMaterial';

describe('UnshadedMaterial', () => {
  it('holds the heightmap it is built with', () => {
    const heightmap = new THREE.Texture();

    expect(new UnshadedMaterial({ displacementMap: heightmap }).displacementMap).toBe(heightmap);
  });

  it('builds without the warning setValues gives a key the base class lacks', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    new UnshadedMaterial({ displacementMap: new THREE.Texture() });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps the heightmap in a clone', () => {
    const heightmap = new THREE.Texture();

    expect(new UnshadedMaterial({ displacementMap: heightmap }).clone().displacementMap).toBe(heightmap);
  });

  it('holds no heightmap by default (edge case)', () => {
    expect(new UnshadedMaterial().displacementMap).toBeNull();
  });

  it('draws as three draws a MeshBasicMaterial', () => {
    expect(new UnshadedMaterial().type).toBe('MeshBasicMaterial');
  });
});
