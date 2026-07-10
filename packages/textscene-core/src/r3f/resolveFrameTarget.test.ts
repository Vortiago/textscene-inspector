import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resolveFrameTarget } from './resolveFrameTarget';

describe('resolveFrameTarget (#224 F-to-frame)', () => {
  it('returns the selected object when its path is registered', () => {
    const scene = new THREE.Scene();
    const selected = new THREE.Object3D();
    const map = new Map([['Root/Cube', selected]]);
    expect(resolveFrameTarget(scene, 'Root/Cube', map)).toBe(selected);
  });

  it('falls back to the whole scene when nothing is selected', () => {
    const scene = new THREE.Scene();
    const map = new Map<string, THREE.Object3D>();
    expect(resolveFrameTarget(scene, null, map)).toBe(scene);
  });

  it('falls back to the whole scene when the selected path is not registered', () => {
    const scene = new THREE.Scene();
    const map = new Map<string, THREE.Object3D>();
    expect(resolveFrameTarget(scene, 'Root/Missing', map)).toBe(scene);
  });

  it('falls back to the whole scene when there is no nodeObjectMap at all', () => {
    const scene = new THREE.Scene();
    expect(resolveFrameTarget(scene, 'Root/Cube', null)).toBe(scene);
  });
});
