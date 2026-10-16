import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { recordedOn, recordedUniform } from './recordedOnMaterial';

describe('recordedOn', () => {
  it('reads the value a material records', () => {
    const material = new THREE.MeshBasicMaterial({ userData: { scale: 0.5 } });
    expect(recordedOn(material, 'scale', 1)).toBe(0.5);
  });

  it('keeps a recorded zero, which is a real value (edge case)', () => {
    const material = new THREE.MeshBasicMaterial({ userData: { scale: 0 } });
    expect(recordedOn(material, 'scale', 1)).toBe(0);
  });

  it('falls back for a material that records nothing (error case)', () => {
    expect(recordedOn(new THREE.MeshBasicMaterial(), 'scale', 1)).toBe(1);
  });
});

describe('recordedUniform', () => {
  it('reads the value the material records at each read, so a later record needs no new uniform', () => {
    const material = new THREE.MeshBasicMaterial({ userData: { scale: 0.5 } });
    const uniform = recordedUniform(material, 'scale', 1);
    material.userData = { scale: 2 };
    expect(uniform.value).toBe(2);
  });

  it('keeps a recorded zero, which is a real value (edge case)', () => {
    const material = new THREE.MeshBasicMaterial({ userData: { scale: 0 } });
    expect(recordedUniform(material, 'scale', 1).value).toBe(0);
  });

  it('falls back for a material that records nothing (error case)', () => {
    expect(recordedUniform(new THREE.MeshBasicMaterial(), 'scale', 1).value).toBe(1);
  });
});
