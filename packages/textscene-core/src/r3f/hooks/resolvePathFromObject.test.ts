import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resolvePathFromObject } from './resolvePathFromObject';

describe('resolvePathFromObject', () => {
  it('returns null for a null/undefined object', () => {
    const map = new WeakMap<THREE.Object3D, string>();
    expect(resolvePathFromObject(null, map)).toBeNull();
    expect(resolvePathFromObject(undefined, map)).toBeNull();
  });

  it('resolves the path when the object itself is registered', () => {
    const mesh = new THREE.Object3D();
    const map = new WeakMap<THREE.Object3D, string>([[mesh, 'Root/Cube']]);
    expect(resolvePathFromObject(mesh, map)).toBe('Root/Cube');
  });

  it('walks up through unregistered ancestors to find the nearest registered one', () => {
    const root = new THREE.Object3D();
    const wrapper = new THREE.Object3D(); // node wrapper — registered
    const inner = new THREE.Object3D(); // component-internal group — NOT registered
    const mesh = new THREE.Mesh(); // the actually-hit geometry — NOT registered
    root.add(wrapper);
    wrapper.add(inner);
    inner.add(mesh);

    const map = new WeakMap<THREE.Object3D, string>([[wrapper, 'Root/MeshInstance3D']]);
    expect(resolvePathFromObject(mesh, map)).toBe('Root/MeshInstance3D');
  });

  it('a child node wrapper wins over an ancestor node wrapper (innermost-wins parity)', () => {
    const parentWrapper = new THREE.Object3D();
    const childWrapper = new THREE.Object3D();
    const mesh = new THREE.Mesh();
    parentWrapper.add(childWrapper);
    childWrapper.add(mesh);

    const map = new WeakMap<THREE.Object3D, string>([
      [parentWrapper, 'Root'],
      [childWrapper, 'Root/Child'],
    ]);
    expect(resolvePathFromObject(mesh, map)).toBe('Root/Child');
  });

  it('returns null when no ancestor in the chain is registered', () => {
    const root = new THREE.Object3D();
    const mesh = new THREE.Mesh();
    root.add(mesh);
    const map = new WeakMap<THREE.Object3D, string>();
    expect(resolvePathFromObject(mesh, map)).toBeNull();
  });

  it('stops at the nearest match and does not keep climbing past it', () => {
    const grandparent = new THREE.Object3D();
    const parent = new THREE.Object3D();
    const child = new THREE.Object3D();
    grandparent.add(parent);
    parent.add(child);

    const map = new WeakMap<THREE.Object3D, string>([
      [grandparent, 'Grandparent'],
      [parent, 'Grandparent/Parent'],
    ]);
    expect(resolvePathFromObject(child, map)).toBe('Grandparent/Parent');
  });
});
