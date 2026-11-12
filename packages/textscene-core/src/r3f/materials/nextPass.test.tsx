/**
 * The drawn element of the next_pass seam. The chain and its owners carry the behaviour through
 * their own tests, and `nextPassWalk.test.ts` holds the walk.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { drawnElementOf } from './nextPass';

describe('drawnElementOf', () => {
  const skeleton = new THREE.Skeleton([new THREE.Bone()]);

  it('skins a triangles draw by the given skeleton, detached, in mesh space', () => {
    const { Drawn, skin } = drawnElementOf(false, skeleton);
    expect(Drawn).toBe('skinnedMesh');
    expect(skin).toEqual({ skeleton, bindMode: THREE.DetachedBindMode });
  });

  it('skins a points draw by nothing: a point skinned is not a point draw', () => {
    const { Drawn, skin } = drawnElementOf(true, skeleton);
    expect(Drawn).toBe('points');
    expect(skin).toEqual({});
  });

  it('draws an unskinned triangles surface as a mesh', () => {
    expect(drawnElementOf(false, null).Drawn).toBe('mesh');
    expect(drawnElementOf(false, undefined).Drawn).toBe('mesh');
  });
});
