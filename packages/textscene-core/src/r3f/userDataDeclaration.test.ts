import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { userDataDeclaration } from './userDataDeclaration';

interface Size {
  width: number;
}

const size = userDataDeclaration<Size>('size', (candidate) => typeof candidate.width === 'number');

describe('userDataDeclaration', () => {
  it('reads back what userData declares', () => {
    const object = new THREE.Object3D();
    object.userData = size.userData({ width: 3 });
    expect(size.read(object)).toEqual({ width: 3 });
  });

  it('keeps the declaration under its own key, so entries merge into one userData (edge case)', () => {
    expect(size.userData({ width: 0 })).toEqual({ size: { width: 0 } });
  });

  it('answers null for an object that declared nothing', () => {
    expect(size.read(new THREE.Object3D())).toBeNull();
  });

  it('answers null for a value that is not an object (error case)', () => {
    const object = new THREE.Object3D();
    object.userData = { size: null };
    expect(size.read(object)).toBeNull();
    object.userData = { size: 3 };
    expect(size.read(object)).toBeNull();
  });

  it('answers null for an object of the wrong shape (error case)', () => {
    const object = new THREE.Object3D();
    object.userData = { size: { width: '3' } };
    expect(size.read(object)).toBeNull();
  });
});
